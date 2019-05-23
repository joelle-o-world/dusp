\version "2.18.2"
\score {
<<
\new Voice {
\override TextScript.size = #'1.5
\override TextScript.fret-diagram-details.finger-code = #'in-dot
\absolute {
	\clef "treble_8"

\override TextSpanner.bound-details.left.text = \markup { \bold II }
< d-0 a-4 f'-7 g'-5 g'-3 bes'-1 >1\arpeggio^\markup { \fret-diagram-terse #"o;4-4;x;6-7;5-5;2-3;2-1;" } \startTextSpan
< g-6 bes-4 g'-5 a'-3 bes'-1 >1\arpeggio^\markup { \fret-diagram-terse #"5-6;5-4;x;x;5-5;4-3;2-1;" }
< e-6 g'-3 bes'-1 >1\arpeggio^\markup { \fret-diagram-terse #"2-6;x;x;x;x;2-3;2-1;" } \stopTextSpan
< c'-7 g'-5 >1\arpeggio^\markup { \fret-diagram-terse #"x;7-7;x;x;5-5;x;x;" } \stopTextSpan
\break

< d-0 d'-7 d'-0 >1\arpeggio^\markup { \fret-diagram-terse #"o;9-7;x;x;o;x;x;" } \stopTextSpan
< b-4 aes-0 b-0 >1\arpeggio^\markup { \fret-diagram-terse #"x;6-4;o;o;x;x;x;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold II }
< aes-6 a-4 bes-1 a'-7 aes'-2 c''-3 >1\arpeggio^\markup { \fret-diagram-terse #"6-6;4-4;2-1;x;7-7;3-2;4-3;" } \startTextSpan \stopTextSpan
< d-0 f-0 bes'-7 f'-0 d''-3 >1\arpeggio^\markup { \fret-diagram-terse #"o;o;x;x;8-7;o;6-3;" } \stopTextSpan
\break


\override TextSpanner.bound-details.left.text = \markup { \bold I }
< d-0 g-4 a-2 des'-5 d'-0 ges'-1 >1\arpeggio^\markup { \fret-diagram-terse #"o;2-4;1-2;2-5;o;1-1;x;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold II }
< g'-1 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;x;x;x;2-1;x;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold VIII }
< ees'-5 a'-6 des''-1 g''-7 >1\arpeggio^\markup { \fret-diagram-terse #"x;10-5;x;10-6;x;8-1;11-7;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold XI }
< aes-0 ees''-6 e''-1 bes''-4 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;o;16-6;x;11-1;14-4;" } \startTextSpan \stopTextSpan
\break

r1\arpeggio^\markup { \fret-diagram-terse #"x;x;x;x;x;x;x;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold VIII }
< d-0 f-0 f'-4 b-0 b'-5 f'-0 ges''-7 >1\arpeggio^\markup { \fret-diagram-terse #"o;o;9-4;o;9-5;o;10-7;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold X }
< ges'-3 b-0 ees''-6 ges''-1 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;10-3;o;13-6;x;10-1;" } \startTextSpan \stopTextSpan
< bes-3 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;2-3;x;x;x;x;" } \stopTextSpan
\break

\pageBreak


\override TextSpanner.bound-details.left.text = \markup { \bold I }
< f-4 aes-5 aes-0 f'-0 c''-7 >1\arpeggio^\markup { \fret-diagram-terse #"3-4;3-5;o;x;x;o;4-7;" } \startTextSpan \stopTextSpan
< bes'-6 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;x;x;x;x;2-6;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold VIII }
< des'-7 f-0 aes-0 aes'-2 ees''-5 >1\arpeggio^\markup { \fret-diagram-terse #"11-7;o;o;9-2;x;10-5;x;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold III }
< d-0 f-0 aes-0 d'-2 d'-0 aes'-1 >1\arpeggio^\markup { \fret-diagram-terse #"o;o;o;3-2;o;3-1;x;" } \startTextSpan \stopTextSpan
\break

< c'-2 g'-3 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;x;1-2;x;2-3;x;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold IX }
< e'-7 aes'-4 b-0 e''-3 >1\arpeggio^\markup { \fret-diagram-terse #"14-7;x;12-4;o;x;11-3;x;" } \startTextSpan \stopTextSpan
< des'-7 ees'-5 >1\arpeggio^\markup { \fret-diagram-terse #"11-7;x;7-5;x;x;x;x;" } \stopTextSpan
< g-7 >1\arpeggio^\markup { \fret-diagram-terse #"5-7;x;x;x;x;x;x;" } \stopTextSpan
\break


\override TextSpanner.bound-details.left.text = \markup { \bold X }
< aes'-6 b'-4 a'-1 d''-2 g''-3 b''-5 >1\arpeggio^\markup { \fret-diagram-terse #"x;15-6;15-4;10-1;12-2;14-3;15-5;" } \startTextSpan \stopTextSpan
< aes-0 ees'-2 aes'-3 c''-5 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;o;x;1-2;3-3;4-5;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold IX }
< f'-7 g'-6 bes'-4 ees''-3 >1\arpeggio^\markup { \fret-diagram-terse #"x;12-7;11-6;11-4;x;10-3;x;" } \startTextSpan \stopTextSpan
< g'-6 a'-4 ees''-3 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;11-6;10-4;x;10-3;x;" } \stopTextSpan
\break


\override TextSpanner.bound-details.left.text = \markup { \bold VI }
< bes-5 c''-7 b'-3 d''-1 >1\arpeggio^\markup { \fret-diagram-terse #"8-5;x;x;x;10-7;6-3;6-1;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold VIII }
< des'-5 aes-0 b-0 ees''-3 e''-1 >1\arpeggio^\markup { \fret-diagram-terse #"11-5;x;o;o;x;10-3;8-1;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold VII }
< b-5 b-0 ees''-1 >1\arpeggio^\markup { \fret-diagram-terse #"9-5;x;x;o;x;x;7-1;" } \startTextSpan \stopTextSpan
< des'-5 ees'-3 aes'-7 c''-2 ees''-4 >1\arpeggio^\markup { \fret-diagram-terse #"11-5;10-3;12-7;x;10-2;10-4;x;" }
\break

\pageBreak

< ees'-5 e'-3 c''-6 c''-2 ges''-4 >1\arpeggio^\markup { \fret-diagram-terse #"13-5;11-3;x;13-6;10-2;13-4;x;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold IV }
< bes-3 ges'-2 bes'-4 c''-1 >1\arpeggio^\markup { \fret-diagram-terse #"x;5-3;x;x;4-2;5-4;4-1;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold IX }
< ees'-3 aes'-5 c''-6 f'-0 f''-1 >1\arpeggio^\markup { \fret-diagram-terse #"x;10-3;12-5;13-6;x;o;9-1;" } \startTextSpan \stopTextSpan
< d-0 d'-3 g'-5 bes'-2 ees''-4 >1\arpeggio^\markup { \fret-diagram-terse #"o;9-3;11-5;x;8-2;10-4;x;" } \stopTextSpan
\break


\override TextSpanner.bound-details.left.text = \markup { \bold V }
< c'-7 c'-3 aes-0 aes'-6 f'-0 des''-1 >1\arpeggio^\markup { \fret-diagram-terse #"10-7;7-3;o;9-6;x;o;5-1;" } \startTextSpan
< d-0 d'-5 b-0 g'-4 >1\arpeggio^\markup { \fret-diagram-terse #"o;x;6-5;o;5-4;x;x;" } \stopTextSpan
< ees'-5 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;7-5;x;x;x;x;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold I }
< ges-4 a-3 aes-0 e'-6 aes'-7 >1\arpeggio^\markup { \fret-diagram-terse #"4-4;4-3;o;5-6;6-7;x;x;" } \startTextSpan \stopTextSpan
\break


\override TextSpanner.bound-details.left.text = \markup { \bold VIII }
< c'-2 bes'-6 d''-7 >1\arpeggio^\markup { \fret-diagram-terse #"10-2;x;x;11-6;12-7;x;x;" } \startTextSpan \stopTextSpan
r1\arpeggio^\markup { \fret-diagram-terse #"x;x;x;x;x;x;x;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold II }
< ges-6 bes-7 d'-3 e'-1 a'-4 c''-5 >1\arpeggio^\markup { \fret-diagram-terse #"4-6;5-7;x;3-3;2-1;4-4;4-5;" } \startTextSpan \stopTextSpan
< ees'-6 e'-2 f''-4 >1\arpeggio^\markup { \fret-diagram-terse #"13-6;11-2;x;x;x;12-4;x;" } \stopTextSpan
\break


\override TextSpanner.bound-details.left.text = \markup { \bold IV }
< aes-6 f-0 aes-0 f'-0 des''-3 >1\arpeggio^\markup { \fret-diagram-terse #"6-6;o;o;x;x;o;5-3;" } \startTextSpan \stopTextSpan
< aes-6 f-0 aes-0 f'-0 >1\arpeggio^\markup { \fret-diagram-terse #"6-6;o;o;x;x;o;x;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold I }
< f-6 c'-1 f'-4 ges'-2 b'-3 >1\arpeggio^\markup { \fret-diagram-terse #"3-6;x;x;1-1;3-4;1-2;3-3;" } \startTextSpan \stopTextSpan
< ges-6 c'-7 >1\arpeggio^\markup { \fret-diagram-terse #"4-6;x;4-7;x;x;x;x;" } \stopTextSpan
\break

\pageBreak


\override TextSpanner.bound-details.left.text = \markup { \bold III }
< bes-4 ees'-7 f'-5 ges'-3 f'-0 >1\arpeggio^\markup { \fret-diagram-terse #"x;5-4;7-7;6-5;4-3;o;x;" } \startTextSpan \stopTextSpan
< e'-5 ges'-3 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;x;5-5;4-3;x;x;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold II }
< d-0 c'-7 b-4 d'-5 d'-0 >1\arpeggio^\markup { \fret-diagram-terse #"o;7-7;3-4;3-5;o;x;x;" } \startTextSpan \stopTextSpan
< g-6 c'-5 >1\arpeggio^\markup { \fret-diagram-terse #"x;2-6;x;1-5;x;x;x;" } \stopTextSpan
\break

< d-0 d'-2 d'-0 >1\arpeggio^\markup { \fret-diagram-terse #"o;9-2;x;x;o;x;x;" } \stopTextSpan
< d-0 a-2 d'-0 >1\arpeggio^\markup { \fret-diagram-terse #"o;4-2;x;x;o;x;x;" } \stopTextSpan
< ges-2 des'-6 aes'-7 des''-5 >1\arpeggio^\markup { \fret-diagram-terse #"x;1-2;5-6;x;6-7;x;5-5;" } \stopTextSpan
< g'-6 des''-3 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;11-6;x;11-3;x;x;" } \stopTextSpan
\break


\override TextSpanner.bound-details.left.text = \markup { \bold VII }
< c'-7 ges'-1 d''-2 f''-5 >1\arpeggio^\markup { \fret-diagram-terse #"10-7;x;x;7-1;x;9-2;9-5;" } \startTextSpan \stopTextSpan
< b-7 aes-0 b-0 >1\arpeggio^\markup { \fret-diagram-terse #"9-7;x;o;o;x;x;x;" } \stopTextSpan
< g-4 >1\arpeggio^\markup { \fret-diagram-terse #"5-4;x;x;x;x;x;x;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold IX }
< d'-4 ees'-2 des''-7 ees''-6 f''-5 ges''-3 >1\arpeggio^\markup { \fret-diagram-terse #"12-4;10-2;x;14-7;13-6;12-5;10-3;" } \startTextSpan \stopTextSpan
\break

< b-4 b-2 aes-0 b-0 des''-6 e''-5 e''-3 >1\arpeggio^\markup { \fret-diagram-terse #"9-4;6-2;o;o;11-6;11-5;8-3;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold VIII }
< b-4 g'-1 des''-6 >1\arpeggio^\markup { \fret-diagram-terse #"9-4;x;x;8-1;11-6;x;x;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold IV }
< f'-7 ees'-1 a'-6 b'-2 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;9-7;4-1;7-6;6-2;x;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold III }
< d-0 des'-5 d'-1 aes'-6 >1\arpeggio^\markup { \fret-diagram-terse #"o;x;5-5;3-1;6-6;x;x;" } \startTextSpan \stopTextSpan
\break

\pageBreak


\override TextSpanner.bound-details.left.text = \markup { \bold X }
< aes'-5 a'-1 ees''-6 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;12-5;10-1;13-6;x;x;" } \startTextSpan \stopTextSpan
< g'-3 ees''-6 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;11-3;x;13-6;x;x;" } \stopTextSpan
< b-3 b-0 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;3-3;o;x;x;x;" } \stopTextSpan
< f-0 f'-3 f'-0 >1\arpeggio^\markup { \fret-diagram-terse #"x;o;9-3;x;x;o;x;" } \stopTextSpan
\break


\override TextSpanner.bound-details.left.text = \markup { \bold VIII }
< ees'-7 e'-3 b'-5 c''-4 des''-1 >1\arpeggio^\markup { \fret-diagram-terse #"13-7;x;8-3;12-5;10-4;8-1;x;" } \startTextSpan \stopTextSpan
< g-7 f-0 a-3 ees'-5 f'-4 f'-0 >1\arpeggio^\markup { \fret-diagram-terse #"5-7;o;1-3;4-5;3-4;o;x;" } \stopTextSpan
< g-7 aes-2 aes-0 >1\arpeggio^\markup { \fret-diagram-terse #"5-7;3-2;o;x;x;x;x;" } \stopTextSpan
< a-7 b-6 b-0 d'-0 >1\arpeggio^\markup { \fret-diagram-terse #"7-7;6-6;x;o;o;x;x;" } \stopTextSpan
\break

< des'-6 aes-0 f'-0 >1\arpeggio^\markup { \fret-diagram-terse #"x;8-6;o;x;x;o;x;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold I }
< aes-6 c'-7 e'-4 a'-1 >1\arpeggio^\markup { \fret-diagram-terse #"x;3-6;4-7;x;2-4;x;1-1;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold IX }
< d-0 d'-6 d'-0 f'-0 f''-1 >1\arpeggio^\markup { \fret-diagram-terse #"o;9-6;x;x;o;o;9-1;" } \startTextSpan
< d-0 g'-6 e''-7 f''-4 >1\arpeggio^\markup { \fret-diagram-terse #"o;14-6;x;x;14-7;12-4;x;" } \stopTextSpan
\break

< d-0 f-0 a'-5 bes'-4 >1\arpeggio^\markup { \fret-diagram-terse #"o;o;x;x;7-5;5-4;x;" } \stopTextSpan
< des''-2 ges''-4 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;x;x;11-2;13-4;x;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold VIII }
< c'-3 g'-1 >1\arpeggio^\markup { \fret-diagram-terse #"10-3;x;x;8-1;x;x;x;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold VI }
< b-3 e'-7 ges'-6 f'-1 b'-4 >1\arpeggio^\markup { \fret-diagram-terse #"9-3;11-7;10-6;6-1;9-4;x;x;" } \startTextSpan \stopTextSpan
\break

\pageBreak


\override TextSpanner.bound-details.left.text = \markup { \bold II }
< f-3 f-0 aes-0 des'-1 f'-0 >1\arpeggio^\markup { \fret-diagram-terse #"3-3;o;o;2-1;x;o;x;" } \startTextSpan \stopTextSpan
< g-3 f-0 b-0 a'-5 d''-6 f''-7 >1\arpeggio^\markup { \fret-diagram-terse #"5-3;o;x;o;7-5;9-6;9-7;" } \stopTextSpan
< f-0 aes-0 aes'-6 bes'-2 >1\arpeggio^\markup { \fret-diagram-terse #"x;o;o;x;x;3-6;2-2;" } \stopTextSpan
< bes'-6 c''-4 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;x;x;x;5-6;4-4;" } \stopTextSpan
\break


\override TextSpanner.bound-details.left.text = \markup { \bold I }
< d-0 ges-2 d'-7 d'-0 a'-6 c''-4 >1\arpeggio^\markup { \fret-diagram-terse #"o;1-2;6-7;x;o;4-6;4-4;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold VI }
< d-0 d'-1 b-0 d'-0 b'-6 >1\arpeggio^\markup { \fret-diagram-terse #"o;x;6-1;o;o;6-6;x;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold VIII }
< ees'-7 e'-1 bes'-5 f''-6 ges''-4 >1\arpeggio^\markup { \fret-diagram-terse #"13-7;x;8-1;11-5;x;12-6;10-4;" } \startTextSpan \stopTextSpan
< f-0 aes-0 f'-0 f''-2 >1\arpeggio^\markup { \fret-diagram-terse #"x;o;o;x;x;o;9-2;" } \stopTextSpan
\break


\override TextSpanner.bound-details.left.text = \markup { \bold I }
< g-6 aes-5 a-1 f'-7 g'-4 a'-2 >1\arpeggio^\markup { \fret-diagram-terse #"5-6;3-5;1-1;6-7;x;2-4;1-2;" } \startTextSpan \stopTextSpan
< g'-3 >1\arpeggio^\markup { \fret-diagram-terse #"x;x;11-3;x;x;x;x;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold VII }
< d'-6 e'-3 c''-5 des''-2 f''-4 >1\arpeggio^\markup { \fret-diagram-terse #"12-6;x;8-3;x;10-5;8-2;9-4;" } \startTextSpan \stopTextSpan
< a-6 des'-3 aes'-5 aes'-2 >1\arpeggio^\markup { \fret-diagram-terse #"7-6;x;5-3;x;6-5;3-2;x;" } \stopTextSpan
\break


\override TextSpanner.bound-details.left.text = \markup { \bold VI }
< bes-6 b-1 ees'-3 bes'-5 c''-2 ges''-7 >1\arpeggio^\markup { \fret-diagram-terse #"8-6;6-1;7-3;x;8-5;7-2;10-7;" } \startTextSpan \stopTextSpan
< ees'-6 f-0 f'-3 d'-0 d''-2 g''-4 >1\arpeggio^\markup { \fret-diagram-terse #"13-6;o;9-3;x;o;9-2;11-4;" } \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold II }
< c'-5 aes-0 des'-1 aes'-2 des''-4 >1\arpeggio^\markup { \fret-diagram-terse #"x;7-5;o;2-1;x;3-2;5-4;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold VI }
< bes-3 ees'-5 f'-1 des''-2 e''-4 >1\arpeggio^\markup { \fret-diagram-terse #"8-3;10-5;x;6-1;x;8-2;8-4;" } \startTextSpan \stopTextSpan
\break

\pageBreak


\override TextSpanner.bound-details.left.text = \markup { \bold IX }
< ges'-5 aes-0 aes'-1 ees''-7 e''-2 aes''-4 >1\arpeggio^\markup { \fret-diagram-terse #"x;13-5;o;9-1;13-7;11-2;12-4;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold III }
< d-0 d'-1 ges'-7 b'-4 >1\arpeggio^\markup { \fret-diagram-terse #"o;x;x;3-1;4-7;x;3-4;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold VII }
< bes-3 ges'-1 des''-7 d''-5 e''-4 >1\arpeggio^\markup { \fret-diagram-terse #"8-3;x;x;7-1;11-7;9-5;8-4;" } \startTextSpan \stopTextSpan

\override TextSpanner.bound-details.left.text = \markup { \bold V }
< a-3 ges'-6 e'-1 d'-0 d''-5 >1\arpeggio^\markup { \fret-diagram-terse #"7-3;x;10-6;5-1;o;9-5;x;" } \startTextSpan \stopTextSpan
\break

}}
>>
\layout {}
\midi {}
}