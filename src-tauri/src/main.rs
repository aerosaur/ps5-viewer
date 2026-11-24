#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::Manager;

/// Set once the WebView2 permission handler is installed. The page waits for it before
/// asking for the camera, so WebView2 never gets the chance to show its own prompt.
struct CaptureReady(Arc<AtomicBool>);

#[tauri::command]
fn capture_ready(state: tauri::State<'_, CaptureReady>) -> bool {
    state.0.load(Ordering::SeqCst)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // Off Windows there is no handler to wait for.
        .manage(CaptureReady(Arc::new(AtomicBool::new(!cfg!(windows)))))
        .invoke_handler(tauri::generate_handler![capture_ready])
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window missing");
            #[cfg(windows)]
            {
                let ready = app.state::<CaptureReady>().0.clone();
                window.with_webview(move |webview| {
                    unsafe { allow_capture_permissions(&webview.controller()) };
                    ready.store(true, Ordering::SeqCst);
                })?;
            }
            #[cfg(not(windows))]
            let _ = window;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PS5 Viewer");
}

/// Grants camera/microphone to the app's own page so WebView2 never prompts.
#[cfg(windows)]
unsafe fn allow_capture_permissions(
    controller: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller,
) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_PERMISSION_KIND, COREWEBVIEW2_PERMISSION_KIND_CAMERA,
        COREWEBVIEW2_PERMISSION_KIND_MICROPHONE, COREWEBVIEW2_PERMISSION_STATE_ALLOW,
    };
    use webview2_com::PermissionRequestedEventHandler;

    let Ok(core) = controller.CoreWebView2() else { return };
    let handler = PermissionRequestedEventHandler::create(Box::new(|_, args| {
        if let Some(args) = args {
            let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
            args.PermissionKind(&mut kind)?;
            if kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA
                || kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE
            {
                args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)?;
            }
        }
        Ok(())
    }));
    let mut token = Default::default();
    let _ = core.add_PermissionRequested(&handler, &mut token);
}
