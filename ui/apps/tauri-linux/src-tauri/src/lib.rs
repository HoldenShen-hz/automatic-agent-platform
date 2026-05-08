#[tauri::command]
fn healthcheck() -> &'static str {
    "ok"
}

#[tauri::command]
fn open_deep_link(url: String) -> String {
    format!("opened:{url}")
}

#[tauri::command]
fn run_shell(command: String) -> String {
    format!("linux:{command}")
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![healthcheck, open_deep_link, run_shell])
        .run(tauri::generate_context!())
        .expect("failed to run tauri linux baseline");
}
