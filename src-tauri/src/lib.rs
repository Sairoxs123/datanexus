use std::process::Child;
#[cfg(debug_assertions)]
use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;
#[cfg(not(debug_assertions))]
use tauri_plugin_shell::ShellExt;

// Store the backend process for cleanup
struct BackendProcess(Mutex<Option<Child>>);

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg(debug_assertions)]
#[cfg(windows)]
fn spawn_backend(backend_path: &std::path::Path) -> Option<Child> {
    // Development mode on Windows: spawn backend via command line
    let child = Command::new("cmd")
        .args([
            "/c",
            ".\\venv\\Scripts\\activate && python -m uvicorn main:app --reload",
        ])
        .current_dir(backend_path)
        .spawn();

    match child {
        Ok(process) => {
            let pid = process.id();
            println!("Backend server started in dev mode with PID: {}", pid);
            Some(process)
        }
        Err(e) => {
            eprintln!("Failed to start backend server: {}", e);
            None
        }
    }
}

#[cfg(debug_assertions)]
#[cfg(not(windows))]
fn spawn_backend(backend_path: &std::path::Path) -> Option<Child> {
    // Development mode on Unix: spawn backend via python
    let child = Command::new("python")
        .args(["-m", "uvicorn", "main:app", "--reload"])
        .current_dir(backend_path)
        .spawn();

    match child {
        Ok(process) => {
            let pid = process.id();
            println!("Backend server started in dev mode with PID: {}", pid);
            Some(process)
        }
        Err(e) => {
            eprintln!("Failed to start backend server: {}", e);
            None
        }
    }
}

#[cfg(not(debug_assertions))]
fn spawn_backend_sidecar(app: &tauri::AppHandle) {
    // Build/production mode: use sidecar pattern
    match app.shell().sidecar("backend") {
        Ok(sidecar_command) => {
            match sidecar_command.spawn() {
                Ok((mut _rx, _child)) => {
                    println!("Backend sidecar started");
                }
                Err(e) => {
                    eprintln!("Failed to spawn backend sidecar: {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to create sidecar command: {}", e);
        }
    }
}

#[cfg(debug_assertions)]
fn kill_backend(mut process: Child) {
    // Development mode: kill the spawned process directly
    let _ = process.kill();
    println!("Backend server stopped");
}

#[cfg(not(debug_assertions))]
fn kill_backend(_process: Child) {
    // Build/production mode: sidecar handles its own cleanup
    println!("Backend sidecar stopped");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            // Get the path to the backend directory
            let backend_dir = app
                .path()
                .resource_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap())
                .parent()
                .map(|p| p.join("backend"))
                .unwrap_or_else(|| std::path::PathBuf::from("backend"));

            // In development, use the workspace backend folder
            let backend_path = if cfg!(debug_assertions) {
                std::env::current_dir()
                    .unwrap()
                    .parent()
                    .map(|p| p.join("backend"))
                    .unwrap_or_else(|| std::path::PathBuf::from("backend"))
            } else {
                backend_dir
            };

            println!("Starting backend from: {:?}", backend_path);
            println!("Debug mode: {}", cfg!(debug_assertions));

            #[cfg(debug_assertions)]
            {
                // Development mode: spawn using shell commands
                if let Some(process) = spawn_backend(&backend_path) {
                    let state = app.state::<BackendProcess>();
                    *state.0.lock().unwrap() = Some(process);
                }
            }

            #[cfg(not(debug_assertions))]
            {
                // Build mode: use sidecar pattern
                spawn_backend_sidecar(&app.handle());
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Kill the backend process when the window is destroyed
                let state: tauri::State<BackendProcess> = window.state();
                let mut guard = state.0.lock().unwrap();
                if let Some(process) = guard.take() {
                    kill_backend(process);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
