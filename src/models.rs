use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::util;

pub const ACCENTS: [&str; 7] = [
    "pink", "teal", "lavender", "peach", "ochre", "mint", "coral",
];

fn default_accent() -> String {
    "peach".to_string()
}

fn default_category() -> String {
    "益智".to_string()
}

fn default_entry() -> String {
    "index.html".to_string()
}

fn default_icon() -> String {
    "🎮".to_string()
}

fn default_true() -> bool {
    true
}

/// 一个游戏 = `games/<slug>/game.json` + 静态文件。
/// `slug` 不写在 JSON 里，由目录名决定，保证 URL 和目录永远一致。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    #[serde(skip_deserializing, default)]
    pub slug: String,
    pub title: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_category")]
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub age: String,
    #[serde(default = "default_accent")]
    pub accent: String,
    #[serde(default = "default_icon")]
    pub icon: String,
    /// 封面文件（相对游戏目录），留空会自动找 `cover.png/jpg/webp/svg/gif`。
    #[serde(default)]
    pub cover: Option<String>,
    #[serde(default = "default_entry")]
    pub entry: String,
    #[serde(default)]
    pub controls: String,
    #[serde(default = "default_true")]
    pub published: bool,
    #[serde(default)]
    pub featured: bool,
    /// 越小越靠前；0 表示未设置，排在已设置顺序的游戏之后。
    #[serde(default)]
    pub order: i64,
    #[serde(default)]
    pub meta: Map<String, Value>,
    /// 由扫描器根据 game.json 的修改时间填充，用于封面缓存刷新。
    #[serde(skip_deserializing, default)]
    pub updated_at: u64,
}

impl Game {
    pub fn validate(&mut self) -> Result<(), String> {
        self.title = self.title.trim().to_string();
        self.summary = self.summary.trim().to_string();
        self.description = self.description.trim().to_string();
        self.category = self.category.trim().to_string();
        self.age = self.age.trim().to_string();
        self.controls = self.controls.trim().to_string();
        self.icon = self.icon.trim().to_string();
        self.accent = self.accent.trim().to_ascii_lowercase();
        self.entry = self.entry.trim().replace('\\', "/");

        if !util::is_valid_slug(&self.slug) {
            return Err("目录名必须是 2–48 位小写字母、数字或连字符".into());
        }
        if self.title.is_empty() || self.title.chars().count() > 80 {
            return Err("title 需要 1–80 个字".into());
        }
        if self.summary.chars().count() > 200 {
            return Err("summary 最多 200 个字".into());
        }
        if self.description.chars().count() > 8000 {
            return Err("description 最多 8000 个字".into());
        }
        if self.category.is_empty() || self.category.chars().count() > 24 {
            return Err("category 需要 1–24 个字".into());
        }
        if !ACCENTS.contains(&self.accent.as_str()) {
            return Err(format!("accent 只能是 {} 之一", ACCENTS.join(" / ")));
        }
        if self.icon.chars().count() > 16 {
            return Err("icon 最多 16 个字符".into());
        }
        if self.tags.len() > 12 {
            return Err("tags 最多 12 个".into());
        }
        self.tags = self
            .tags
            .iter()
            .map(|tag| tag.trim().to_string())
            .filter(|tag| !tag.is_empty())
            .collect();
        if self.tags.iter().any(|tag| tag.chars().count() > 24) {
            return Err("单个 tag 最多 24 个字".into());
        }
        if self.age.chars().count() > 24 {
            return Err("age 最多 24 个字".into());
        }
        if self.controls.chars().count() > 200 {
            return Err("controls 最多 200 个字".into());
        }
        util::validate_relative_path(&self.entry)
            .map_err(|_| "entry 必须是游戏目录内的相对路径，例如 index.html".to_string())?;
        if !self.entry.to_ascii_lowercase().ends_with(".html") {
            return Err("entry 必须是 .html 文件".into());
        }
        if let Some(cover) = &self.cover {
            util::validate_relative_path(cover)
                .map_err(|_| "cover 必须是游戏目录内的相对路径".to_string())?;
        }
        Ok(())
    }

    pub fn sort_order(&self) -> i64 {
        if self.order == 0 {
            i64::MAX / 2
        } else {
            self.order
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteSettings {
    pub title: String,
    pub tagline: String,
    pub description: String,
    #[serde(default = "default_accent")]
    pub accent: String,
    #[serde(default = "default_categories")]
    pub categories: Vec<String>,
}

fn default_categories() -> Vec<String> {
    ["益智", "动作", "音乐", "故事", "创意", "运动"]
        .iter()
        .map(|item| item.to_string())
        .collect()
}

impl Default for SiteSettings {
    fn default() -> Self {
        Self {
            title: "倪的乐园".to_string(),
            tagline: "小手点一点，快乐玩一天".to_string(),
            description: "给小朋友的迷你游戏乐园，打开网页就能玩，没有广告，不用注册。".to_string(),
            accent: "pink".to_string(),
            categories: default_categories(),
        }
    }
}

impl SiteSettings {
    pub fn validate(&mut self) -> Result<(), String> {
        self.title = self.title.trim().to_string();
        self.tagline = self.tagline.trim().to_string();
        self.description = self.description.trim().to_string();
        self.accent = self.accent.trim().to_ascii_lowercase();

        if self.title.is_empty() || self.title.chars().count() > 40 {
            return Err("站点 title 需要 1–40 个字".into());
        }
        if self.tagline.chars().count() > 80 {
            return Err("tagline 最多 80 个字".into());
        }
        if self.description.chars().count() > 300 {
            return Err("站点 description 最多 300 个字".into());
        }
        if !ACCENTS.contains(&self.accent.as_str()) {
            return Err("站点 accent 不合法".into());
        }
        if self.categories.is_empty() || self.categories.len() > 16 {
            return Err("categories 需要 1–16 个".into());
        }
        self.categories = self
            .categories
            .iter()
            .map(|category| category.trim().to_string())
            .filter(|category| !category.is_empty())
            .collect();
        if self.categories.is_empty() {
            return Err("categories 不能为空".into());
        }
        if self.categories.iter().any(|c| c.chars().count() > 16) {
            return Err("单个分类最多 16 个字".into());
        }
        Ok(())
    }
}

pub fn sort_games(games: &mut [Game]) {
    games.sort_by(|a, b| {
        b.featured
            .cmp(&a.featured)
            .then(a.sort_order().cmp(&b.sort_order()))
            .then(a.title.cmp(&b.title))
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Game {
        Game {
            slug: "demo-game".into(),
            title: "示例".into(),
            summary: String::new(),
            description: String::new(),
            category: "益智".into(),
            tags: vec![],
            age: String::new(),
            accent: "pink".into(),
            icon: "🎮".into(),
            cover: None,
            entry: "index.html".into(),
            controls: String::new(),
            published: true,
            featured: false,
            order: 0,
            meta: Map::new(),
            updated_at: 0,
        }
    }

    #[test]
    fn validates_good_game() {
        let mut game = sample();
        assert!(game.validate().is_ok());
    }

    #[test]
    fn rejects_bad_slug_and_accent() {
        let mut game = sample();
        game.slug = "Bad Slug".into();
        assert!(game.validate().is_err());

        let mut game = sample();
        game.accent = "rainbow".into();
        assert!(game.validate().is_err());
    }

    #[test]
    fn rejects_traversal_entry() {
        let mut game = sample();
        game.entry = "../index.html".into();
        assert!(game.validate().is_err());
    }

    #[test]
    fn sorting_prefers_featured_then_order() {
        let mut a = sample();
        a.title = "A".into();
        a.order = 2;
        let mut b = sample();
        b.slug = "another-game".into();
        b.title = "B".into();
        b.featured = true;
        let mut c = sample();
        c.slug = "third-game".into();
        c.title = "C".into();
        c.order = 1;
        let mut games = vec![a, b, c];
        sort_games(&mut games);
        assert_eq!(games[0].slug, "another-game");
        assert_eq!(games[1].slug, "third-game");
        assert_eq!(games[2].slug, "demo-game");
    }
}
