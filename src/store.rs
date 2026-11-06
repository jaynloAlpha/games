use std::path::{Path, PathBuf};
use std::sync::Arc;

use tokio::sync::RwLock;

use crate::models::{sort_games, Game, SiteSettings};

/// 只读目录扫描结果：部署后不需要数据库，游戏和站点配置都在磁盘上。
pub struct Store {
    games_dir: PathBuf,
    site_file: PathBuf,
    state: RwLock<State>,
}

struct State {
    site: SiteSettings,
    games: Vec<Game>,
    key: String,
}

pub struct CheckReport {
    pub games: Vec<Game>,
    pub site: SiteSettings,
    pub warnings: Vec<String>,
}

impl Store {
    pub async fn load(games_dir: PathBuf, site_file: PathBuf) -> Arc<Self> {
        let scan = {
            let games_dir = games_dir.clone();
            tokio::task::spawn_blocking(move || scan_games(&games_dir))
                .await
                .unwrap_or_else(|err| ScanResult {
                    games: Vec::new(),
                    errors: vec![format!("扫描游戏目录失败：{err}")],
                })
        };
        for error in &scan.errors {
            tracing::warn!("{error}");
        }

        let (site, site_warning) = load_site(&site_file);
        if let Some(warning) = &site_warning {
            tracing::warn!("{warning}");
        }

        let key = fingerprint(&scan.games, &site);
        let state = State {
            site,
            games: scan.games,
            key,
        };
        tracing::info!(
            games = state.games.len(),
            published = state.games.iter().filter(|game| game.published).count(),
            "游戏清单已加载"
        );
        Arc::new(Self {
            games_dir,
            site_file,
            state: RwLock::new(state),
        })
    }

    pub async fn site(&self) -> SiteSettings {
        self.state.read().await.site.clone()
    }

    pub async fn games(&self) -> Vec<Game> {
        self.state.read().await.games.clone()
    }

    pub async fn public_games(&self) -> Vec<Game> {
        self.state
            .read()
            .await
            .games
            .iter()
            .filter(|game| game.published)
            .cloned()
            .collect()
    }

    pub async fn get(&self, slug: &str) -> Option<Game> {
        self.state
            .read()
            .await
            .games
            .iter()
            .find(|game| game.slug == slug)
            .cloned()
    }

    pub async fn get_published(&self, slug: &str) -> Option<Game> {
        self.get(slug).await.filter(|game| game.published)
    }

    pub fn game_dir(&self, slug: &str) -> PathBuf {
        self.games_dir.join(slug)
    }

    pub async fn cover_path(&self, slug: &str) -> Option<PathBuf> {
        let game = self.get_published(slug).await?;
        if let Some(cover) = game.cover {
            let path = self.game_dir(slug).join(cover);
            if tokio::fs::metadata(&path).await.is_ok() {
                return Some(path);
            }
        }
        None
    }

    /// 重新扫描一次；内容有变化时返回 true。供开发时热加载使用。
    pub async fn reload(&self) -> bool {
        let games_dir = self.games_dir.clone();
        let site_file = self.site_file.clone();
        let (scan, site_result) =
            tokio::task::spawn_blocking(move || (scan_games(&games_dir), load_site(&site_file)))
                .await
                .unwrap_or_else(|err| {
                    (
                        ScanResult {
                            games: Vec::new(),
                            errors: vec![format!("扫描失败：{err}")],
                        },
                        (
                            SiteSettings::default(),
                            Some("读取站点配置失败，使用默认值".to_string()),
                        ),
                    )
                });

        for error in &scan.errors {
            tracing::warn!("{error}");
        }
        let (site, site_warning) = site_result;
        if let Some(warning) = site_warning {
            tracing::warn!("{warning}");
        }

        let new_key = fingerprint(&scan.games, &site);
        let mut state = self.state.write().await;
        if state.key == new_key {
            return false;
        }
        state.games = scan.games;
        state.site = site;
        state.key = new_key;
        true
    }
}

/// `--check` 使用的严格校验：任何游戏的 game.json 有问题都会让构建失败。
pub async fn check_catalog(
    games_dir: PathBuf,
    site_file: PathBuf,
) -> Result<CheckReport, Vec<String>> {
    let scan = tokio::task::spawn_blocking(move || scan_games(&games_dir))
        .await
        .map_err(|err| vec![format!("扫描游戏目录失败：{err}")])?;

    let (site, site_warning) = load_site(&site_file);
    let mut errors = scan.errors;
    let mut warnings = Vec::new();
    if let Some(warning) = site_warning {
        if site_file.exists() {
            // 文件存在但解析失败，属于错误。
            errors.push(warning);
        } else {
            warnings.push(warning);
        }
    }
    if errors.is_empty() {
        Ok(CheckReport {
            games: scan.games,
            site,
            warnings,
        })
    } else {
        Err(errors)
    }
}

struct ScanResult {
    games: Vec<Game>,
    errors: Vec<String>,
}

fn scan_games(dir: &Path) -> ScanResult {
    let mut games = Vec::new();
    let mut errors = Vec::new();

    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(err) => {
            errors.push(format!("无法读取 games 目录 {}：{err}", dir.display()));
            return ScanResult { games, errors };
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if name.starts_with('.') || name.starts_with('_') {
            continue;
        }

        let manifest_path = path.join("game.json");
        let text = match std::fs::read_to_string(&manifest_path) {
            Ok(text) => text,
            Err(_) => {
                errors.push(format!("games/{name} 缺少 game.json，已跳过"));
                continue;
            }
        };
        let mut game: Game = match serde_json::from_str(&text) {
            Ok(game) => game,
            Err(err) => {
                errors.push(format!("games/{name}/game.json 解析失败：{err}"));
                continue;
            }
        };
        game.slug = name.to_string();
        if let Err(message) = game.validate() {
            errors.push(format!("games/{name}：{message}"));
            continue;
        }
        if !path.join(&game.entry).is_file() {
            errors.push(format!("games/{name}：入口文件 {} 不存在", game.entry));
            continue;
        }
        if let Some(cover) = game.cover.clone() {
            if !path.join(&cover).is_file() {
                errors.push(format!("games/{name}：封面 {} 不存在，已忽略", cover));
                game.cover = None;
            }
        }
        if game.cover.is_none() {
            game.cover = detect_cover(&path);
        }
        // 用「清单 / 入口 / 封面」里最新的修改时间做缓存版本号，
        // 这样换封面、更新入口文件都会自动让 /covers 的 ?v= 变化。
        let mut updated_at = crate::util::file_mtime_secs(&manifest_path);
        updated_at = updated_at.max(crate::util::file_mtime_secs(&path.join(&game.entry)));
        if let Some(cover) = &game.cover {
            updated_at = updated_at.max(crate::util::file_mtime_secs(&path.join(cover)));
        }
        game.updated_at = updated_at;
        games.push(game);
    }

    sort_games(&mut games);
    ScanResult { games, errors }
}

pub fn detect_cover(dir: &Path) -> Option<String> {
    for name in [
        "cover.png",
        "cover.jpg",
        "cover.jpeg",
        "cover.webp",
        "cover.svg",
        "cover.gif",
    ] {
        if dir.join(name).is_file() {
            return Some(name.to_string());
        }
    }
    None
}

fn load_site(path: &Path) -> (SiteSettings, Option<String>) {
    match std::fs::read_to_string(path) {
        Ok(text) => match serde_json::from_str::<SiteSettings>(&text) {
            Ok(mut site) => match site.validate() {
                Ok(()) => (site, None),
                Err(message) => (
                    SiteSettings::default(),
                    Some(format!("site.json 校验失败（{message}），使用默认站点配置")),
                ),
            },
            Err(err) => (
                SiteSettings::default(),
                Some(format!("site.json 解析失败（{err}），使用默认站点配置")),
            ),
        },
        Err(_) => (
            SiteSettings::default(),
            Some(format!(
                "未找到站点配置 {}，使用默认站点配置",
                path.display()
            )),
        ),
    }
}

fn fingerprint(games: &[Game], site: &SiteSettings) -> String {
    serde_json::to_string(&(games, site)).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    fn write_game(root: &Path, slug: &str, manifest: &str, with_entry: bool) {
        let dir = root.join(slug);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("game.json"), manifest).unwrap();
        if with_entry {
            let mut file = fs::File::create(dir.join("index.html")).unwrap();
            file.write_all(b"<html></html>").unwrap();
        }
    }

    #[test]
    fn scans_and_sorts_games() {
        let dir = tempfile::tempdir().unwrap();
        write_game(dir.path(), "alpha", r#"{"title":"Alpha","order":2}"#, true);
        write_game(
            dir.path(),
            "beta",
            r#"{"title":"Beta","featured":true}"#,
            true,
        );
        write_game(dir.path(), "_template", r#"{"title":"Template"}"#, true);
        write_game(dir.path(), "broken", r#"{"title":}"#, true);
        write_game(dir.path(), "no-entry", r#"{"title":"No Entry"}"#, false);

        let scan = scan_games(dir.path());
        assert_eq!(scan.games.len(), 2);
        assert_eq!(scan.games[0].slug, "beta");
        assert_eq!(scan.games[1].slug, "alpha");
        assert_eq!(scan.errors.len(), 2);
    }

    #[test]
    fn detects_cover_files() {
        let dir = tempfile::tempdir().unwrap();
        write_game(dir.path(), "alpha", r#"{"title":"Alpha"}"#, true);
        fs::write(dir.path().join("alpha/cover.svg"), "<svg/>").unwrap();
        let scan = scan_games(dir.path());
        assert_eq!(scan.games[0].cover.as_deref(), Some("cover.svg"));
    }

    #[test]
    fn rejects_traversal_entry_in_scan() {
        let dir = tempfile::tempdir().unwrap();
        write_game(
            dir.path(),
            "alpha",
            r#"{"title":"Alpha","entry":"../index.html"}"#,
            true,
        );
        let scan = scan_games(dir.path());
        assert!(scan.games.is_empty());
        assert_eq!(scan.errors.len(), 1);
    }
}
