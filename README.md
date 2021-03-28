# TRS-80

This monorepo is a set of TRS-80-related libraries, tools, and web apps written
in TypeScript. The subprojects are:

* [z80-base](packages/z80-base): Utility functions and data structures for dealing with Z80 code.
* [z80-emulator](packages/z80-emulator): Z80 emulator.
* [z80-test](packages/z80-test): Tests for Z80 emulators. Any Z80 emulator can be plugged in here, in case you want to test your own emulator.
* [z80-disasm](packages/z80-disasm): Z80 disassembler.
* [z80-asm](packages/z80-asm): Z80 assembler and IDE.
* [trs80-base](packages/trs80-base): Classes for reading and writing a variety of TRS-80 file formats.
* [trs80-disasm](packages/trs80-disasm): Wrapper around z80-disasm that adds knowledge about the TRS-80, such as the location of ROM routines.
* [trs80-emulator](packages/trs80-emulator): TRS-80 hardware emulator. Can emulate a Model I and Model III, read-only cassette, and read-only floppy disk.
* [trs80-cassette-reader-js](packages/trs80-cassette-reader-js): Web utility and command-line tool for reading cassette WAV files and converting them to CAS files. Does a good job with cassettes that have been partially damaged and can't be read by other converter tools.
* [my-trs-80](packages/my-trs-80): Web app for hosting a virtual TRS-80 and its library of cassettes and floppy disks.

# License

Copyright &copy; Lawrence Kesteloot, [MIT license](LICENSE).

