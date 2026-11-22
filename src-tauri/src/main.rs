#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window missing");
            #[cfg(windows)]
            window.with_webview(|webview| unsafe {
                allow_capture_permissions(&webview.controller());
            })?;
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
