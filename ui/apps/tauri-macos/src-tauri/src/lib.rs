const ALLOWED_COMMANDS: &[&str] = &["status", "health", "version"];
const ALLOWED_DEEP_LINK_SCHEMES: &[&str] = &["aa://", "https://", "http://"];

fn is_command_allowed(command: &str) -> bool {
    ALLOWED_COMMANDS.contains(&command)
}

fn is_allowed_deep_link(url: &str) -> bool {
    url::Url::parse(url)
        .ok()
        .and_then(|parsed| Some(parsed.scheme().to_string()))
        .map(|scheme| format!("{scheme}://"))
        .map(|scheme| {
            ALLOWED_DEEP_LINK_SCHEMES
                .iter()
                .any(|allowed| allowed.eq_ignore_ascii_case(&scheme))
        })
        .unwrap_or(false)
}

#[tauri::command]
fn healthcheck() -> &'static str {
    "ok"
}

#[tauri::command]
fn open_deep_link(url: String) -> Result<String, String> {
    if !is_allowed_deep_link(&url) {
        return Err("rejected:invalid_scheme".to_string());
    }
    Ok(format!("opened:{url}"))
}

#[tauri::command]
fn run_shell(command: String) -> Result<String, String> {
    if !is_command_allowed(&command) {
        return Err(format!("Command not allowed: {}", command));
    }
    Ok(format!("macos:{command}"))
}

#[tauri::command]
fn keychain_store(key: String, value: String) -> Result<String, String> {
    if key.trim().is_empty() {
        return Err("Keychain key must be non-empty".to_string());
    }
    if value.trim().is_empty() {
        return Err("Keychain value must be non-empty".to_string());
    }
    Ok(format!("keychain_store:{key}"))
}

#[tauri::command]
fn keychain_retrieve(key: String) -> Result<String, String> {
    if key.trim().is_empty() {
        return Err("Keychain key must be non-empty".to_string());
    }
    Ok(format!("keychain_retrieve:{key}"))
}

#[tauri::command]
fn spotlight_export(query: String) -> Result<String, String> {
    if query.trim().is_empty() {
        return Err("Spotlight export query must be non-empty".to_string());
    }
    Ok(format!("spotlight_export:{query}"))
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            healthcheck,
            open_deep_link,
            run_shell,
            keychain_store,
            keychain_retrieve,
            spotlight_export
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri macOS baseline");
}
