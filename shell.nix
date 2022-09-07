{ pkgs ? (import ./nix/pinned-nixpkgs.nix) {} }:

with pkgs; mkShellNoCC {
  buildInputs = (import ./nix/dev-tools.nix { inherit pkgs; });

  # Use the SSH client provided by the system (FHS only) to avoid issues with Fedora default settings
  GIT_SSH = if lib.pathExists "/usr/bin/ssh" then "/usr/bin/ssh" else "ssh";
}
