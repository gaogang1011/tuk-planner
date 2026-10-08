# 2차 조사 — 캘린더 화면을 어떻게 보여 줄까

- 작성일: 2026-10-09
- 계기: 1차 버전은 "지금 / 다음"만 보여 줘서, 다음 주 일정을 미리 잡아 둔 경우 전체 일정을 한눈에 확인하기 어렵다는 사용 후기

## 1. 문제 정리

| 상황 | 1차 버전에서 불편한 점 |
|---|---|
| 다음 주 회의를 미리 잡아 둠 | 날짜별 목록을 계속 내려야 해서 한 주의 모양이 안 보인다 |
| 새 미팅 시간을 정해야 함 | 그 주에 어디가 비어 있는지 알 수 없다 |
| 한 달 계획을 세움 | 공휴일, 시험, 바쁜 주가 어디인지 한 화면에서 볼 수 없다 |
| 매주 반복되는 회의 | 매번 따로 입력해야 한다 |

## 2. 참고한 앱과 자료

### Fantastical (iPhone 캘린더)
- 위쪽에 며칠을 가로로 보여 주는 띠(DayTicker)가 있고, 아래 일정 목록과 스크롤이 서로 맞물려 움직인다.
- 날마다 일정이 작은 색 막대로 시간 순서대로 표시돼서, 내용을 읽기 전에 오전·오후가 얼마나 찼는지 알 수 있다.
- 아래로 당기면 월간 달력이 나오고, 날짜를 누르면 그날로 이동한다.
- "내일 5시 30분 동안 지니어스 바"처럼 문장으로 쓰면 날짜·시간·길이를 채워 준다. 툭 플래너의 한 줄 입력과 같은 방향이다.

### Notion Calendar
- 업무와 개인 일정을 한 캘린더에 모아서 회의와 마감을 같이 본다.
- 단축키와 명령 메뉴로 빠르게 조작한다.
- 문서·데이터베이스의 마감일을 캘린더 일정처럼 보여 준다. → 할 일의 마감을 캘린더에 함께 표시할 근거.

### Sunsama (타임박싱)
- 할 일을 캘린더 위로 끌어다 놓으면 그 시간에 할 일정이 된다.
- 예상 소요 시간을 먼저 정해 두면 그 길이로 블록이 생긴다.
- 회의와 할 일을 같은 시간표 위에서 관리하는 것이 핵심이다.

### 월간 보기 구현 사례 (CoreUI Scheduler)
- 한 칸에 보여 줄 일정 수를 정해 두고(기본 4개), 넘치면 "+N개"로 접은 뒤 누르면 그날 보기로 넘어간다.
- 일정을 다른 날로 끌어 놓으면 시간은 그대로 두고 날짜만 옮긴다.

### Ubuntu 캘린더 디자인 가이드
- 월 화면은 좌우로 넘기고, 선택한 날짜는 강조, 오늘은 항상 다른 색으로 표시한다.
- 아래 목록을 위로 올리면 월간 달력이 한 주 줄로 접혀 일정 영역이 넓어진다.

### 캘린더 UX 패턴 정리 (UX Patterns for Developers)
- 키보드만으로 모든 화면을 쓸 수 있어야 하고, 선택·완료 상태를 색으로만 구분하지 않는다.
- 작은 화면에 데스크톱 격자를 그대로 넣지 말고, 카드 목록 같은 다른 형태를 따로 정한다.

## 3. 툭 플래너에 가져올 것

| 아이디어 | 출처 | 툭 플래너 적용 |
|---|---|---|
| 한 주를 시간표로 보기 | 대부분의 캘린더 | **주간 보기**: 7일 × 시간 격자에 일정 블록, 현재 시각선 |
| 하루가 얼마나 찼는지 한눈에 | Fantastical 일정 막대 | 요일 머리에 "회의 3개 · 4시간" 같은 바쁨 표시 |
| 비는 시간 보기 | 1차 버전의 빈 시간 리본 | 주간 보기에서 1시간 이상 빈 시간을 점선으로 표시 (새 미팅 잡을 때 사용) |
| 할 일 마감을 캘린더에 | Notion Calendar | 마감이 있는 할 일을 그날 맨 위 "마감" 줄에 표시 |
| 월간 칸 넘침 처리 | CoreUI | 한 칸 3개까지, 나머지는 "+N개" |
| 날짜 누르면 그날 목록 | Fantastical, Ubuntu | 월간 보기 옆(모바일은 아래)에 하루 일정 패널, 그날 날짜로 바로 추가 |
| 끌어서 옮기기 | CoreUI, Sunsama | 주간·월간에서 일정을 끌어 다른 날·시간으로 이동 |
| 작은 화면은 다른 형태 | UX 패턴 정리 | 모바일 주간 보기는 날짜별 카드 목록, 월간은 칸 안에 점만 |
| 문장으로 입력 | Fantastical | 입력창을 모든 화면 위에 두고, 추가하면 캘린더가 그 날짜로 이동해 강조 |

## 4. 추가로 넣을 기능 (미리 잡는 일정을 위해)

- **반복 일정**: "매주 월요일 10시 팀 회의", "매일 9시 스탠드업"을 한 번에 등록
- **일정 겹침 경고**: 추가 전 미리보기에서 같은 시간에 이미 있는 일정을 알려 줌
- **한국 공휴일 표시**: 미리 계획할 때 쉬는 날을 함께 봐야 하므로 2026~2027년 공휴일(대체공휴일 포함)을 달력에 표시. 날짜는 한국 공휴일 정리 사이트(kholidayz.com) 기준.

## 5. 이번에 하지 않는 것

- 구글 캘린더 등 외부 캘린더 연동, 여러 날에 걸친 일정, 반복 일정의 한 회차만 따로 수정
- 할 일을 시간표에 끌어다 놓는 타임박싱 (다음 개선점으로 남김)

## 출처

- [MacStories — Fantastical for iPhone 리뷰](https://www.macstories.net/reviews/fantastical-for-iphone-review/)
- [Notion — Introducing Notion Calendar](https://www.notion.com/blog/introducing-notion-calendar)
- [Sunsama — Timeboxing: the basics](https://help.sunsama.com/docs/getting-started/basics/timeboxing-the-basics)
- [CoreUI Scheduler — Month View](https://coreui.io/scheduler/docs/views/month/)
- [Ubuntu — App patterns applied: calendar key journeys](https://ubuntu.com/blog/app-patterns-applied-calendar-key-journeys)
- [UX Patterns for Developers — Calendar](https://skillselion.com/skills/thedaviddias/ux-patterns-for-developers/calendar)
- [kholidayz — 2026 공휴일](https://kholidayz.com/year/2026), [2027 공휴일](https://kholidayz.com/year/2027)
