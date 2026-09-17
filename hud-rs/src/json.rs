// ============================================================
// 极简 JSON 解析器
// ============================================================
//
// 只为了不引入依赖。支持对象 / 数组 / 字符串 / 数字 / true / false / null，
// 足够解析 Claude Code 传进来的 statusLine 载荷和 transcript 行。

use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Json>),
    Obj(HashMap<String, Json>),
}

impl Json {
    pub fn get(&self, key: &str) -> Option<&Json> {
        match self {
            Json::Obj(map) => map.get(key),
            _ => None,
        }
    }

    /// 链式取值：`json.path(&["context_window", "current_usage", "input_tokens"])`
    pub fn path(&self, keys: &[&str]) -> Option<&Json> {
        let mut cur = self;
        for k in keys {
            cur = cur.get(k)?;
        }
        Some(cur)
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Json::Str(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Json::Num(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_u64(&self) -> Option<u64> {
        self.as_f64().filter(|n| *n >= 0.0).map(|n| n as u64)
    }
}

pub fn parse(input: &str) -> Option<Json> {
    let bytes = input.as_bytes();
    let mut pos = 0usize;
    skip_ws(bytes, &mut pos);
    let value = parse_value(bytes, &mut pos)?;
    Some(value)
}

fn skip_ws(b: &[u8], pos: &mut usize) {
    while *pos < b.len() && matches!(b[*pos], b' ' | b'\t' | b'\n' | b'\r') {
        *pos += 1;
    }
}

fn parse_value(b: &[u8], pos: &mut usize) -> Option<Json> {
    skip_ws(b, pos);
    if *pos >= b.len() {
        return None;
    }
    match b[*pos] {
        b'{' => parse_object(b, pos),
        b'[' => parse_array(b, pos),
        b'"' => parse_string(b, pos).map(Json::Str),
        b't' => expect_lit(b, pos, "true").then_some(Json::Bool(true)),
        b'f' => expect_lit(b, pos, "false").then_some(Json::Bool(false)),
        b'n' => expect_lit(b, pos, "null").then_some(Json::Null),
        _ => parse_number(b, pos),
    }
}

fn expect_lit(b: &[u8], pos: &mut usize, lit: &str) -> bool {
    if b.len() >= *pos + lit.len() && &b[*pos..*pos + lit.len()] == lit.as_bytes() {
        *pos += lit.len();
        true
    } else {
        false
    }
}

fn parse_object(b: &[u8], pos: &mut usize) -> Option<Json> {
    *pos += 1; // '{'
    let mut map = HashMap::new();
    skip_ws(b, pos);
    if *pos < b.len() && b[*pos] == b'}' {
        *pos += 1;
        return Some(Json::Obj(map));
    }
    loop {
        skip_ws(b, pos);
        let key = parse_string(b, pos)?;
        skip_ws(b, pos);
        if *pos >= b.len() || b[*pos] != b':' {
            return None;
        }
        *pos += 1;
        let value = parse_value(b, pos)?;
        map.insert(key, value);
        skip_ws(b, pos);
        if *pos >= b.len() {
            return None;
        }
        match b[*pos] {
            b',' => *pos += 1,
            b'}' => {
                *pos += 1;
                return Some(Json::Obj(map));
            }
            _ => return None,
        }
    }
}

fn parse_array(b: &[u8], pos: &mut usize) -> Option<Json> {
    *pos += 1; // '['
    let mut items = Vec::new();
    skip_ws(b, pos);
    if *pos < b.len() && b[*pos] == b']' {
        *pos += 1;
        return Some(Json::Arr(items));
    }
    loop {
        let value = parse_value(b, pos)?;
        items.push(value);
        skip_ws(b, pos);
        if *pos >= b.len() {
            return None;
        }
        match b[*pos] {
            b',' => *pos += 1,
            b']' => {
                *pos += 1;
                return Some(Json::Arr(items));
            }
            _ => return None,
        }
    }
}

fn parse_string(b: &[u8], pos: &mut usize) -> Option<String> {
    if *pos >= b.len() || b[*pos] != b'"' {
        return None;
    }
    *pos += 1;
    let mut out: Vec<u8> = Vec::new();
    while *pos < b.len() {
        let c = b[*pos];
        match c {
            b'"' => {
                *pos += 1;
                return String::from_utf8(out).ok();
            }
            b'\\' => {
                *pos += 1;
                if *pos >= b.len() {
                    return None;
                }
                let esc = b[*pos];
                *pos += 1;
                match esc {
                    b'"' => out.push(b'"'),
                    b'\\' => out.push(b'\\'),
                    b'/' => out.push(b'/'),
                    b'b' => out.push(0x08),
                    b'f' => out.push(0x0c),
                    b'n' => out.push(b'\n'),
                    b'r' => out.push(b'\r'),
                    b't' => out.push(b'\t'),
                    b'u' => {
                        let hex = b.get(*pos..*pos + 4)?;
                        let cp = u32::from_str_radix(std::str::from_utf8(hex).ok()?, 16).ok()?;
                        *pos += 4;
                        // 代理对：高位后紧跟一个 \u 低位
                        if (0xd800..0xdc00).contains(&cp) {
                            if b.get(*pos..*pos + 2)? == b"\\u" {
                                let lo_hex = b.get(*pos + 2..*pos + 6)?;
                                let lo = u32::from_str_radix(
                                    std::str::from_utf8(lo_hex).ok()?,
                                    16,
                                )
                                .ok()?;
                                if (0xdc00..0xe000).contains(&lo) {
                                    *pos += 6;
                                    let combined =
                                        0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
                                    let ch = char::from_u32(combined)?;
                                    let mut buf = [0u8; 4];
                                    out.extend_from_slice(ch.encode_utf8(&mut buf).as_bytes());
                                    continue;
                                }
                            }
                            out.extend_from_slice("\u{FFFD}".as_bytes());
                            continue;
                        }
                        let ch = char::from_u32(cp).unwrap_or('\u{FFFD}');
                        let mut buf = [0u8; 4];
                        out.extend_from_slice(ch.encode_utf8(&mut buf).as_bytes());
                    }
                    _ => return None,
                }
            }
            _ => {
                out.push(c);
                *pos += 1;
            }
        }
    }
    None
}

fn parse_number(b: &[u8], pos: &mut usize) -> Option<Json> {
    let start = *pos;
    if *pos < b.len() && (b[*pos] == b'-' || b[*pos] == b'+') {
        *pos += 1;
    }
    while *pos < b.len()
        && (b[*pos].is_ascii_digit()
            || matches!(b[*pos], b'.' | b'e' | b'E' | b'+' | b'-'))
    {
        *pos += 1;
    }
    if start == *pos {
        return None;
    }
    std::str::from_utf8(&b[start..*pos])
        .ok()?
        .parse::<f64>()
        .ok()
        .map(Json::Num)
}
