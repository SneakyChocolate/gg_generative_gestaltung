{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = with pkgs; [
    # Local HTTP server (Rust)
    miniserve

    # Language Servers
    vscode-langservers-extracted
    typescript-language-server
  ];

  shellHook = ''
  '';
}
