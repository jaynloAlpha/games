use std::path::PathBuf;

/// 运行时配置：环境变量优先，命令行参数可以覆盖。
#[derive(Debug, Clone)]
pub struct Config {
    pub bind: String,
    pub games_dir: PathBuf,
    pub site_file: PathBuf,
    /// 开发时每 10 秒扫描一次 games/，改完游戏刷新页面即可。
    pub watch: bool,
    /// `--check`：只校验游戏清单和站点配置，然后退出。
    pub check: bool,
}

impl Config {
    pub fn load() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        let mut config = Self {
            bind: env_or("CLAY_BIND", "0.0.0.0:8080"),
            games_dir: PathBuf::from(env_or("CLAY_GAMES_DIR", "games")),
            site_file: PathBuf::from(env_or("CLAY_SITE_FILE", "site.json")),
            watch: env_flag("CLAY_WATCH", true),
            check: false,
        };

        let mut args = std::env::args().skip(1);
        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--check" => config.check = true,
                "--no-watch" => config.watch = false,
                "--games" => {
                    let value = args
                        .next()
                        .ok_or_else(|| anyhow::anyhow!("--games 需要一个目录参数"))?;
                    config.games_dir = PathBuf::from(value);
                }
                "--site" => {
                    let value = args
                        .next()
                        .ok_or_else(|| anyhow::anyhow!("--site 需要一个文件参数"))?;
                    config.site_file = PathBuf::from(value);
                }
                "--bind" => {
                    let value = args
                        .next()
                        .ok_or_else(|| anyhow::anyhow!("--bind 需要一个地址参数"))?;
                    config.bind = value;
                }
                "--help" | "-h" => {
                    print_help();
                    std::process::exit(0);
                }
                other => {
                    anyhow::bail!("未知参数 {other}，使用 --help 查看用法");
                }
            }
        }

        Ok(config)
    }
}

fn env_or(key: &str, default: &str) -> String {
    match std::env::var(key) {
        Ok(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => default.to_string(),
    }
}

fn env_flag(key: &str, default: bool) -> bool {
    match std::env::var(key) {
        Ok(value) => !matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "0" | "false" | "off" | "no"
        ),
        Err(_) => default,
    }
}

fn print_help() {
    println!(
        "\
泥泥乐园 Clay Play

用法:
  clayplay [选项]

选项:
  --bind <ADDR>    监听地址，默认 0.0.0.0:8080
  --games <DIR>    游戏目录，默认 games/
  --site <FILE>    站点配置，默认 site.json
  --no-watch       关闭开发时的目录热加载
  --check          只校验游戏清单和站点配置
  -h, --help       显示帮助

环境变量:
  CLAY_BIND / CLAY_GAMES_DIR / CLAY_SITE_FILE / CLAY_WATCH / RUST_LOG
"
    );
}
