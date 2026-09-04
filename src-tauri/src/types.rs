use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize, Debug, Clone)]
pub struct VersionManifest {
    pub latest: LatestVersions,
    pub versions: Vec<VersionEntry>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct VersionEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub url: String,
}

fn default_assets() -> String {
    "1.21".to_string() // Значение по умолчанию для 1.21.x
}

fn default_main_class() -> String {
    "cpw.mods.bootstraplauncher.BootstrapLauncher".to_string()
}

#[derive(Deserialize, Debug, Clone)]
pub struct VersionDetails {
    pub id: String,
    #[serde(default)]
    pub arguments: Arguments,
    #[serde(default = "default_assets")]
    pub assets: String,
    
    #[serde(rename = "assetIndex")]
    pub asset_index: Option<AssetIndexInfo>,
    
    #[serde(default)]
    pub downloads: Downloads,
    
    pub libraries: Vec<Library>,
    
    #[serde(rename = "mainClass", default = "default_main_class")]
    pub main_class: String,
}

#[derive(Deserialize, Debug, Clone, Default)]
pub struct Arguments {
    #[serde(default)]
    pub game: Vec<serde_json::Value>,
    #[serde(default)]
    pub jvm: Vec<serde_json::Value>,
}

#[derive(Deserialize, Debug, Clone, Default)]
pub struct Downloads {
    #[serde(default)]
    pub client: DownloadEntry,
}

#[derive(Deserialize, Debug, Clone, Default)]
pub struct DownloadEntry {
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub sha1: String,
    #[serde(default)]
    pub size: i64,
}

#[derive(Deserialize, Debug, Clone)]
pub struct Library {
    pub name: String,
    pub downloads: LibraryDownloads,
    #[serde(default)]
    pub rules: Vec<Rule>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct LibraryDownloads {
    pub artifact: Option<Artifact>,
    pub classifiers: Option<HashMap<String, Artifact>>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct Artifact {
    pub path: String,
    pub url: String,
    pub sha1: String,
    pub size: i64,
}

#[derive(Deserialize, Debug, Clone)]
pub struct Rule {
    pub action: String,
    pub os: Option<OsRule>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct OsRule {
    pub name: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct AssetsIndex {
    pub objects: HashMap<String, AssetObject>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct AssetObject {
    pub hash: String,
    pub size: i64,
}

#[derive(Deserialize, Debug, Clone)]
pub struct AssetIndexInfo {
    pub id: String,
    pub sha1: String,
    pub size: i64,
    #[serde(rename = "totalSize")]
    pub total_size: i64,
    pub url: String,
}