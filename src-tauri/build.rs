fn main() {
    tauri_build::build();

    // Ensure this runs on every build so the build date stays accurate.
    println!("cargo:rerun-if-env-changed=SOURCE_DATE_EPOCH");
    println!("cargo:rerun-if-changed=../.git/HEAD");

    let build_date = std::process::Command::new("date")
        // RFC3339 UTC for easy parsing at runtime.
        .args(["-u", "+%Y-%m-%dT%H:%M:%SZ"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string());

    let git_sha = std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .current_dir(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".."))
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string());

    println!("cargo:rustc-env=MDCAT_BUILD_DATE_UTC={}", build_date);
    println!("cargo:rustc-env=MDCAT_GIT_SHA={}", git_sha);
}
