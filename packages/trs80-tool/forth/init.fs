\ (n d -- q)
: / /mod swap drop ;
\ (n d -- r)
: mod /mod drop ;
\ define a constant: 123 constant foo
: constant word create ' enter , ' lit , , ' exit , ;
\ define a variable, initialized to 0: variable foo
\ read with: foo @
\ write with: 5 foo !
: variable here @ 0 , word create ' enter , ' lit , , ' exit , ;
\ control structures.
: if immediate ' 0branch , here @ 0 , ;
: then immediate dup here @ swap - swap ! ;
: else immediate ' branch , here @ 0 , swap dup here @ swap - swap ! ;
: not if 0 else 1 then ;
\ (a b c -- a b c b c)
: 2dup over over ;
\ basic logic and math.
: <= 2dup < -rot = or ;
: > <= not ;
: >= < not ;
: <> = not ;
\ push address of next position in code segment. starts all loops, essentially
\ recording the top address of the loop.
: begin immediate here @ ;
\ loop until non-zero: begin 123 . cr 0 until
\ add "0branch <DELTA>" to code, where DELTA is the relative jump to the start of the loop.
\ the only thing left on the parameter stack (after the top address) should be the test value.
: until immediate ' 0branch , here @ - , ;
\ infinite loop: begin 123 . cr until
\ add "branch <DELTA>" to code, where DELTA is the relative jump to the start of the loop.
\ the top of the parameter stack should be the top addressed pushed by "begin".
: again immediate ' branch , here @ - , ;
\ loop while non-zero: 5 begin ?dup while dup . cr 1 - repeat
\ add "0branch 0" to code, where 0 is a temporary that's replaced by "repeat" later.
\ push the address of the zero.
: while immediate ' 0branch , here @ 0 , ;
\ end while loop (see above). add "branch <DELTA>" where DELTA is the relative jump to
\ the top of the loop. Also update the 0 added by "while" with the current IP (past the loop).
: repeat immediate ' branch , swap here @ - , dup here @ swap - swap ! ;

\ do loop: 10 0 do i . cr loop
\ loops from 0 (inclusive) to 10 (exclusive), setting i to value.
variable ivar
: i ivar @ ;
variable limitvar
\ : foo 10 0 do i . cr loop ;
\ compiles to:
\ 10 0 i ! limit ! (*) limit i @ > 0branch (to end) i . cr i @ 1 + i ! branch (to *) (end)
: do immediate ' ivar , ' ! , ' limitvar , ' ! , here @
    ' limitvar , ' @ , ' ivar , ' @ , ' > , ' 0branch , here @ 0 , ;
: loop immediate ' ivar , ' @ , ' lit , 1 , ' + , ' ivar , ' ! , ' branch , swap here @ - , dup here @ swap - swap ! ;
\ : decade 10 0 do i . cr loop ;
\ : mul cr 11 1 do dup i * . loop drop ;


\ write a space to the console.
: space 32 emit ;
\ dump all defined words (including native) to console.
: words latest @ begin ?dup while dup 3 + tell space @ repeat cr ;
\ add address of word being compiled to code segment.
: recurse immediate latest @ >cfa , ;
\ set the output base for the u. command
: decimal 10 base ! ;
: hex 16 base ! ;
: u. base @ /mod ?dup if recurse then dup 10 < if 48 else 55 then + emit ;
\ (x y -- y)
: nip swap drop ;
\ (x y -- y x y )
: tuck swap over ;
\ increment.
: 1+ 1 + ;
\ (x_u ... x_1 x_0 u -- x_u ... x_1 x_0 x_u)
: pick
    1+ \ add one because of 'u' on the stack
    2 * \ multiply by the word size
    dsp@ + \ add to the stack pointer
    @ \ and fetch
;

\ graphics routines
: rx gfx_width rndn ;
: ry gfx_height rndn ;
: rp rx ry set ;
: demo begin rp again ;

\ My own array words.
: array here @ dup rot 2 * + here ! word create ' enter , ' lit , , ' exit , ; \ def an array, specify size in elements
: a[] swap 2 * + ; \ ( index array -- address )
: a@ a[] @ ; \ ( index array -- value )
: a! a[] ! ; \ ( value index array -- )
: @low @ $00FF and ;
: @high @ 8>> ;
: !low dup @ $FF00 and rot $00FF and or swap ! ;
: !high dup @ $00FF and rot 8<< or swap ! ;
: a@low a[] @low ;
: a@high a[] @high ;
: a!low a[] !low ; \ ( value index array -- )
: a!high a[] !high ; \ ( value index array -- )
