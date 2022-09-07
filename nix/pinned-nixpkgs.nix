{}:

let
  pinnedNixpkgs = import (fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/54060e816971276da05970a983487a25810c38a7.tar.gz";
    sha256 = "04jdri767ma52p1vrjhxk0mdj8av5nlsrz53lr43zfvdw97b9r7v";
  }) {};
in pinnedNixpkgs
