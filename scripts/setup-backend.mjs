import { execSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';

execSync('cargo add wasm-bindgen --manifest-path backend/Cargo.toml', { stdio: 'inherit' });
appendFileSync('backend/Cargo.toml', '\n[lib]\ncrate-type = ["cdylib"]\n');
writeFileSync('backend/src/lib.rs', `use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
`);
