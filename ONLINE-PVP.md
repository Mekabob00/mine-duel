# Online PvP — 로컬 실행 및 배포 안내

현재 작업은 **미배포 개발본**이다. 공개 v0.2.3-web과 기존 CPU 대전 규칙은 유지한다. 원격 push, Cloudflare 자원 생성, 공개 서버 배포는 하지 않았다. 기존 코드에 로컬 2인 대전이나 HP는 없으므로 이번에도 그 기능을 있다고 표시하지 않는다.

## 구성

- `web/online.html`, `web/js/online-*`: 별도 온라인 화면·세션·4언어.
- `web/js/main.js`: 기존 ☰ 메뉴의 온라인 대전 진입 버튼 추가. CPU GameUI는 변경하지 않음.
- `server/src/game.js`: 서버 전용 판정. 기존 Board/이웃 계산 재사용, 로컬 Game의 private 상태·종료 정책과 분리.
- `server/src/state.js`: 방 수명, 순서·멱등성, 연결·재대전·시간 정산.
- `server/src/worker.js`: Origin/CORS, IP별 진입 제한, Hibernation WebSocket, SQLite-backed DO 저장·알람.
- `server/wrangler.jsonc`: 새 Worker/Room/Gate 설정. 기존 Pages workflow는 변경하지 않음.
- `docs/`: 기존 빌드가 생성하는 정적 배포본. 온라인 내부 모듈에도 해시 파일명을 부여하며 이전 자산은 보존.

## 로컬 실행

Node.js 22 이상(검증: 24.18.0), npm 사용. 저장소 루트에서:

```powershell
npm ci --prefix web
npm ci --prefix server
npm run build --prefix web
```

서로 다른 터미널 두 개에서 실행한다:

```powershell
npm run dev --prefix server
```

```powershell
npm run start --prefix web
```

[로컬 Pages 하위 경로](http://127.0.0.1:4173/mine-duel/) → 게임 시작 → ☰ → 온라인 대전. 직접 [온라인 화면](http://127.0.0.1:4173/mine-duel/online.html)에 접속해도 된다. 서로 다른 브라우저/프로필로 방 생성·참가 후 양쪽 Ready를 누른다. 같은 프로필의 새 탭은 같은 좌석 복귀로 취급하며 마지막 연결이 제어권을 가진다.

개발 호스트 localhost/127.0.0.1에서만 기본 백엔드 `http://127.0.0.1:8787`을 사용한다. npm run dev는 로컬 프로세스에서만 개발 Origin을 덮어쓴다. 로컬 프런트는 운영 endpoint와 무관하게 localhost 서버를 선택한다. Worker의 ALLOWED_ORIGINS와 정확히 일치하는 프런트 Origin을 써야 한다. 다른 포트를 사용하면 허용 목록도 조정한다. 외부 휴대폰에서 127.0.0.1은 그 휴대폰 자신이므로 이 URL로 PC 서버에 접근할 수 없다.

## 테스트

```powershell
npm test --prefix web
npm test --prefix server
npm run check --prefix server
```

`check`는 `wrangler deploy --dry-run`으로 번들·바인딩을 검사하며 실제 배포하지 않는다. 서버와 정적 서버가 실행 중일 때, `server/` 디렉터리에서:

```powershell
npm run test:browser
npm run test:runtime
node tests/layout.mjs
```

Playwright 브라우저는 기존 `web/node_modules` 설치를 사용한다. 미설치 환경은 `web/`에서 Playwright의 Chromium/WebKit을 설치한다. `browser.mjs`는 실제 20초 알람을 기다려 약 90초, `runtime.mjs`는 두 120초 접속 만료를 병렬 검증하여 약 3분 걸린다. 시뮬레이션 승률 검사가 아니다.

실제 서버 프로세스 재시작을 검사할 때는 `server/`에서 `$env:TEST_RESTART='1'` 후 runtime 테스트를 실행한다. `test-results/restart.request`가 생성되면 기존 Wrangler 프로세스를 종료하고 **같은 디렉터리·같은 `.wrangler` 저장소**로 다시 시작한다. 준비된 뒤 `test-results/restart.done` 파일을 생성한다. 옛 신호 파일은 본인이 만든 해당 파일만 제거한 후 시작한다. `$env:TEST_GRACE='0'`은 이미 실행한 긴 만료 검사를 반복하지 않고 추가 프로토콜·재시작 검사만 실행할 때 쓴다. 환경변수는 테스트 프로그램에만 적용되며 서버의 실제 20초/120초 규칙은 바뀌지 않는다.

`server/test-results/`, 브라우저 프로필 및 `.wrangler/`에는 테스트용 세션 자격 증명/지뢰 원본이 존재할 수 있다. Git에서 제외했으며 보고서용 ZIP에 프로필이나 저장 DB를 넣지 않는다. 운영자 로그에도 토큰/인증 메시지/비공개 보드를 출력하지 않는다.

## 확정 규칙과 처리 선택

- 일반 턴은 탐색부터 END까지 총 20초. 성공한 탐색·설치·마커는 유지하고 남은 행동만 생략한다. 마감 시각 이상인 요청은 거절한다. 불법 요청과 재접속은 시간을 늘리지 않는다.
- 오프닝 각 행동마다 20초. 서버 CSPRNG로 유효한 안전 탐색/지뢰 설치를 자동 수행한다. 초기 중첩은 현행 v0.2.3처럼 허용한다. 자기/공유 지뢰 탐색은 거절하고 상대 단독 지뢰만 KO다.
- KO 우선. 이후 미공개·무마커·지뢰 없는 셀이 0개면 즉시 점수 종료한다. 자기 마커를 제거할 기회보다 종료가 먼저다.
- 남은 본인 마커만 집계. 상대/중첩 +1, 자기 단독/빈칸 -1. 동점 draw, 음수 허용. 기권·접속 종료에는 점수를 쓰지 않는다.
- 양측 Ready가 있어야 시작한다. 최초 선공 무작위, 양측 재대전 동의 후 선공 교대·보드 초기화. 이전 종료 결과는 별도 저장키로 원래 종료 시각부터 24시간 유지한다.
- 명시적 나가기에는 확인 창이 있으며, 대전 중에는 서버의 기권 결과를 확인한 뒤 로컬 세션을 지운다. 단순 탭 종료/이동은 연결 끊김이다.
- WebSocket close/error 즉시 단절을 기록한다. 무통보 단절은 10초 heartbeat와 30초 생존 확인으로 감지하고, **서버가 감지한 단절 시점부터** 120초 복귀 기회를 준다. OS/네트워크의 실제 단절 순간을 서버가 정확히 알 수는 없다.
- 한쪽만 부재면 120초 뒤 패배. 양쪽 부재면 두 사람 모두 120초가 지난 뒤 무효 처리한다. 한 사람이 먼저 만료됐고 상대가 자기 기한 안에 복귀하면 먼저 만료된 사람이 패배한다. 그 전에 KO/속행 불가가 확정됐다면 확정 결과를 유지한다.
- 방 생성 후 24시간 대기실 만료. 게임 중에는 생성 시각으로 지우지 않는다. 마지막 결과 종료 후 24시간에 방을 정리한다. 이전 재대전 결과는 각각의 종료+24시간에 먼저 정리한다.

## 인증·프로토콜

프로토콜 1, ruleset `pvp-1`. 클라이언트 Web Crypto가 256비트 비밀 토큰과 50비트 방 코드를 만들고, HTTPS 생성·참가 요청에 토큰을 전달한다. 서버에는 SHA-256만 저장한다. 토큰은 초대 URL에 포함하지 않는다. 생성/참가는 미리 저장된 같은 코드·토큰으로 재시도하면 같은 좌석에 배정되므로 응답 유실 때 좌석을 추가 소모하지 않는다.

WebSocket 업그레이드 후 첫 메시지 `auth`로 인증한다. 인증 전 snapshot 없음. 10초 내 미인증 연결은 닫는다. 한 방 연결 최대 6개(대기 인증 포함), 인증 연결은 초당 12메시지, HTTP 진입은 IP당 분당 60회를 제한한다. 토큰 없는 참가자는 기존 좌석을 빼앗을 수 없다. Origin 제한은 토큰 인증의 대체물이 아니다. 도배의 완전한 방지나 무제한 무료 운영을 보장하지 않는다.

각 명령은 requestId, seq, gameId, turnId, revision을 검증한다. 마지막 64개 요청은 정확한 ack를 재전송하며, 더 오래된 seq도 다시 적용하지 않는다. 방의 직렬 명령 경로에서 만료를 정산하고 저장·다음 알람 예약을 트랜잭션으로 반영한 뒤 응답한다. 저장 후 통신 실패는 재접속 snapshot과 중복 이력으로 복원한다.

진행 중 snapshot은 자신의 ownMine·공개 숫자·공유 마커만 포함한다. 상대 지뢰 index를 설치 이벤트에 싣지 않는다. 종료 후에는 owners 0/1/2/3과 markerCorrect를 보내 양쪽 지뢰·중첩·마커 판정을 공개한다. `history` 메시지는 인증된 좌석이 해당 방의 보존된 종료 gameId만 조회할 수 있다. 현재 진행 중 게임의 숨은 상태를 조회하는 우회 경로는 없다.

동일 브라우저 종료 후 복귀를 위해 `mineDuel.online.session.v1`에 endpoint·방 코드·토큰·미확인 요청을 저장한다. 언어 키는 그대로다. 이 값은 비밀번호처럼 취급한다. GitHub Pages의 여러 프로젝트는 같은 Origin을 공유하므로 신뢰하지 않는 같은 Origin의 스크립트나 XSS로부터 localStorage를 격리할 수는 없다. 민감한 공개 서비스로 확대하면 전용 프런트 Origin과 인증 구조를 재검토한다. 저장소를 차단한 브라우저에는 온라인 재접속 불가 안내를 보이고 CPU 모드는 유지한다.

## 운영 배포 및 재배포

2026-10-21 Workers plans 화면에서 Free / $0 / Current plan을 확인한 뒤 전용 Worker를 배포했다. 서버 URL: https://mine-duel-online.royee0718.workers.dev . 운영 ALLOWED_ORIGINS는 https://mekabob00.github.io 하나만 허용한다. Room과 Gate는 모두 SQLite-backed migration을 사용한다. 포트폴리오 Pages 프로젝트는 변경하지 않는다.

1. Cloudflare 계정의 Workers/SQLite-backed DO 사용 권한·한도·요금 확인. 개발/운영 Worker·저장소를 분리한다.
2. `server/wrangler.jsonc`의 name, `ALLOWED_ORIGINS`를 실제 허용 프런트 Origin으로 설정한다. 운영 목록에서 localhost 개발 Origin은 제거한다. 이 설정은 공개 URL이며 비밀이 아니다.
3. `server/`에서 Cloudflare 로그인 또는 CI의 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`로 인증한 후 `npx wrangler deploy`를 실행한다. API 토큰은 최소 권한으로 별도 보관하고 repo/프런트 설정/로그에 넣지 않는다. SQLite migration v1과 ROOMS/GATES 바인딩을 함께 배포한다.
4. 반환된 HTTPS Worker URL을 `web/js/online-config.js`의 `ONLINE_ENDPOINT`에 설정한다. 브라우저에 Cloudflare 관리 토큰을 넣으면 안 된다.
5. `npm run build --prefix web`, 전체 테스트 후 승인된 파일만 검토·커밋·push하면 기존 Pages workflow가 프런트를 배포한다. 이 릴리스 시 표시 버전도 별도 확정한다. 이번 온라인 기능 릴리스 버전은 v0.3.0-web이다.
6. 실제 GitHub Pages의 두 브라우저로 접속·초대·시간 초과·재접속·기권·재대전·정보 비공개를 재검증한다. 실제 모바일 및 Cloudflare 휴면/배포 중 소켓 종료는 별도 확인한다.

운영에는 방 수/실패율/실제 SQL 쓰기·DO duration/할당량을 관측해야 한다. 상시 1초 tick은 사용하지 않는다. 장기 결과 인덱스 메모리·저장 남용을 막기 위해 방당 보존 중인 이전 결과 1,000개를 상한으로 두며 초과 시 재대전 시작을 거절하고 새 방 이용을 안내한다. 게임 중 승패에는 이 상한을 적용하지 않는다. 무료 한도 초과·Cloudflare 장애는 게임 패배로 꾸미지 않고 연결 오류로 표시한다.

공식 참고: [Hibernation WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/), [Wrangler](https://developers.cloudflare.com/workers/wrangler/commands/).

## 무료 운영 제한

Workers Free 계정만 사용한다. Paid 전환, 결제수단 추가, 유료 부가 서비스는 수행하지 않는다. 계정이 Paid로 바뀌거나 플랜을 확인할 수 없으면 재배포를 중단한다. Free 할당량 초과는 요청 실패로 허용하며 자동 업그레이드 코드는 없다.

Workers 100,000요청/일·10ms CPU/요청, SQLite DO 100,000요청/일·13,000 GB-s/일·5,000,000 rows read/일·100,000 rows written/일·5GB를 계정 전체에서 공유한다. 정확한 제한은 [공식 가격표](https://developers.cloudflare.com/durable-objects/platform/pricing/)와 계정 대시보드를 확인한다. setAlarm과 저장·삭제도 쓰기 사용량이다.

두 클라이언트가 10분 대전하면 heartbeat만 약 120개, 약 240회의 room/alarm 쓰기를 사용하고 행동·접속·타이머 쓰기가 추가된다. 실제 사용량을 계측한 수치가 아니며 100~200개 명령을 더하면 보수적으로 대전당 600~1,000회 이상의 쓰기를 예상할 수 있다. 안전한 일일 대전 수나 무제한 동시접속을 보장하지 않는다. 도배/빈 방/대기 연결도 무료 한도를 소모할 수 있다. 한도 초과 시 다음 UTC 일자까지 접속이 실패할 수 있다.

프로덕션 검증 스크립트는 TEST_BACKEND_URL, TEST_ORIGIN, TEST_ONLINE_URL, TEST_RESULTS_DIR 환경변수로 대상을 명시한다. 테스트 결과 폴더와 브라우저 프로필은 Git에서 제외한다. 인증 토큰이나 WebSocket auth 원문을 로그에 남기지 않는다.