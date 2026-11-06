use std::fs;
use std::path::Path;

/// 给 web/ 里的前端资源生成内容指纹，注入 `CLAY_ASSET_VERSION`。
/// 模板把它拼到 CSS/JS 的 URL 上，部署后浏览器不会继续用旧脚本。
fn main() {
    let root = Path::new("web");
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325; // FNV-1a 64
    walk(root, root, &mut hash);
    println!("cargo:rustc-env=CLAY_ASSET_VERSION={hash:016x}");
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=web");
}

fn walk(root: &Path, dir: &Path, hash: &mut u64) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut paths: Vec<_> = entries.flatten().map(|entry| entry.path()).collect();
    paths.sort();

    for path in paths {
        println!("cargo:rerun-if-changed={}", path.display());
        if path.is_dir() {
            walk(root, &path, hash);
            continue;
        }
        let Ok(bytes) = fs::read(&path) else {
            continue;
        };
        let relative = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        mix(hash, relative.as_bytes());
        mix(hash, &bytes);
    }
}

fn mix(hash: &mut u64, bytes: &[u8]) {
    for byte in bytes {
        *hash ^= u64::from(*byte);
        *hash = hash.wrapping_mul(0x100_0000_01b3);
    }
}
