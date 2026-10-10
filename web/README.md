# Mine Duel 웹 버전

HTML/CSS/JavaScript ES Modules로 만든 서버 없는 턴제 지뢰찾기. v0.1.1-web.
Unity 1.3의 실제 규칙과 UI를 참고했습니다. 기존 Unity 프로젝트는 수정하지 않았습니다.

## 로컬 실행

Node.js 22 이상 권장. 저장소 루트에서:

```sh
npm run start --prefix web
```

http://127.0.0.1:4173/web/ 에서 플레이합니다. 파일을 더블클릭하는 file:// 실행은 ES Modules 때문에 지원하지 않습니다.
다른 정적 서버로 web 또는 docs 폴더를 제공해도 됩니다. 런타임 외부 의존성이 없으므로 게임 실행에 npm 설치는 필요하지 않습니다.
테스트용 서버는 localhost에만 연결합니다. 같은 Wi-Fi의 실제 휴대폰 검사는 별도 LAN 서버 또는 배포 URL을 사용하세요.

## 규칙 및 구현

- 8×8, 인간 선공. 양측 안전한 시작 칸 공개 → 양측 초기 지뢰 설치 → 일반 턴. 초기 지뢰만 중복 금지.
- 일반 턴은 한 칸 탐색 → 지뢰 하나 설치 → 턴 종료. 자기 지뢰도 밟으면 패배. 0 자동 공개 없음.
- 자기 지뢰에 재설치 금지. 상대 지뢰 중복 설치 허용. 주변 숫자는 지뢰가 있는 칸을 한 번만 계산하며 설치 후 즉시 갱신. 중복 여부 별도 통지 없음.
- 마커는 미공개 칸에만 설치, 기존 지뢰 위에도 가능. 턴당 최대 1개 신규 설치, 자기 마커만 제거. 제거해도 횟수 복구 없음. 마커 칸은 탐색/설치 차단.
- 최초 탐색자는 계속 저장됩니다. 플레이어 #BBD7FF / CPU #FFBDBD, 숫자는 #18263C.
- CPU 실수 확률 쉬움 40%, 보통 20%, 어려움 5%. 초기 안전 공개에는 실수 판단 없음. 안전 미확정 후보가 없으면 정상 판단. 자기 지뢰/마커는 탐색 제외.
- CPU 설치 전략은 60% 전체 무작위 / 25% 최근 플레이어 탐색 주변 / 15% 모든 공개 칸 주변. 해당 후보가 없으면 전체 무작위. 초기 충돌 건너뛰기는 시스템 실행기에서만 처리.
- CPU 탐색/설치/마커 결정에는 Game/Board 참조를 전달하지 않습니다. Game의 private board에서 만든 동결된 관측값만 전달하며 숨겨진 상대 지뢰 소유권이 없습니다.
- CPU가 지뢰를 밟으면 승리, 플레이어는 패배. 미공개 칸이 모두 마커로 막히면 즉시 무승부. 필수 설치가 불가능해도 무승부. 자기 마커 제거로 설치가 가능하다면 제거 기회를 유지.
- CPU의 자기 지뢰 회피 때문에 후보가 소진된 경우에도 무승부로 끝냅니다. 이는 Unity에서 사용하던 종료 처리입니다.
- 시작 안내의 기본 난이도는 보통. 재시작하면 다시 선택 가능. 게임 중 도움말은 난이도 변경 차단, CPU 남은 지연 보존, 바깥 터치/닫기 버튼으로 복귀. 내부 스크롤은 닫기 동작과 분리.
- native dialog의 모달 입력 차단/포커스 제한, 접근성 이름, 실제 button, 키보드 조작 지원. 결과 화면에서도 규칙 보기 가능.
- Safe Area, visualViewport/dynamic viewport 변화 대응. 작은 세로 화면에서는 보드 크기를 남은 높이에 맞춰 조절합니다. 지나치게 낮은 화면 및 가로 화면은 스크롤을 허용해 칸을 과도하게 축소하지 않습니다.
- 화면 터치는 touch-action:manipulation으로 더블탭 확대 오조작을 줄입니다. 규칙 본문은 세로 터치 스크롤 가능. 접근성을 위해 핀치 확대를 강제로 막지 않습니다.

## 테스트

```sh
npm ci --prefix web
npm run build --prefix web
npm test --prefix web
npm exec --prefix web -- playwright install chromium webkit
# 다른 터미널에서 로컬 서버가 실행 중인 상태로:
npm run test:browser --prefix web
```

Node 내장 테스트로 규칙, 소유권, 중복 숫자, 마커, 승패/무승부, CPU 정보 차단/난이도/설치 전략, 지연 보존, 배포 파일 연결을 검사합니다.
Chromium 및 WebKit의 모바일 터치 에뮬레이션과 PC 화면에서 실제 UI를 검사합니다. 보고서 및 캡처는 로컬 web/test-results/ (Git 제외)에 생성됩니다. 실물 Android/iPhone 검증을 대신하지 않습니다.

## GitHub Pages

web/은 원본, docs/는 배포본입니다. 로컬에서 `npm run build --prefix web`로 docs를 갱신합니다.
배포본은 js/css 파일 내용과 의존성에 따라 해시 파일명을 생성하므로 업데이트 시 리소스 캐시 영향을 줄입니다. index.html 캐시가 남아 있으면 페이지를 새로고침하세요. Service Worker는 사용하지 않습니다.

저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 선택하세요.
포함된 `.github/workflows/pages.yml`은 main push 시 web을 빌드하고 규칙 테스트를 통과한 docs만 배포합니다. Actions 탭에서 수동 실행도 가능합니다.
배포가 완료되면 Settings → Pages에 실제 URL이 표시됩니다. 이후 같은 저장소/main에 web 수정사항을 커밋하고 push하면 같은 URL에서 최신 버전이 제공됩니다.
공식 안내: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

Actions 대신 branch 배포를 선택하려면 Source를 Deploy from a branch, main /docs로 설정하세요. 이 방식은 매번 로컬 build 후 docs 변경사항까지 커밋해야 합니다. 자동 workflow와 branch 배포를 동시에 쓰지 마세요.

## 파일 구조 및 업데이트

- index.html, css/style.css: 한국어 화면, 팝업, 모바일 레이아웃.
- js/config.js: 웹 버전, 보드 설정, 난이도 확률, 설치 전략 비율.
- js/board.js: 칸 상태 및 인접 계산. js/game.js: 단일 규칙 모델/턴/종료.
- js/ai.js: 관측 기반 추론/CPU 선택 및 분리된 실행기.
- js/timer.js: CPU 대기 일시 정지/재개. js/ui.js, js/main.js: UI/이벤트.
- scripts/build.mjs: 상대 경로를 유지하는 해시 배포본 생성.
- scripts/serve.mjs: 원본 및 /mine-duel/ 하위 경로 배포본 로컬 서버.
- tests/: Node 규칙 테스트와 브라우저 자동 테스트.
- package.json, package-lock.json: 개발용 테스트 의존성. 게임 런타임에는 포함하지 않습니다.

버전 변경은 js/config.js의 VERSION에서 합니다. 코드를 바꾸면 리소스 해시는 버전 변경 여부와 무관하게 갱신됩니다.
현재 Unity 폴더 내에 웹 파일과 별도 Git 저장소 mine-duel/이 함께 있다면 GitHub Desktop이 사용하는 mine-duel/web을 수정해 push하거나, 프로젝트 web 변경을 mine-duel/web에 복사한 뒤 커밋하세요.
Unity 파일, APK, 인증서/키스토어, .codex 원격 첨부, node_modules는 배포본에 포함하지 않습니다.

## MVP 범위

페이지 새로고침 시 새 게임. 저장, 계정, 네트워크 대전, 사운드, Service Worker, 서버/DB는 미구현입니다.
최신 Android Chrome/iOS Safari를 대상으로 하며, native dialog/ES Modules/private class fields 지원이 필요합니다.

