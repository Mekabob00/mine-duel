export const LANGUAGES = Object.freeze({ ko: '한국어', ja: '日本語', en: 'English', 'zh-CN': '简体中文' });
export const LANGUAGE_KEY = 'mineDuel.language';
// Each row is Korean / Japanese / English / Simplified Chinese. Text is rendered as text, never HTML.
const rows = {
  viewBoard: ['보드 보기','盤面を見る','View board','查看棋盘'],
  viewResults: ['결과 보기','結果を見る','View results','查看结果'],
  winTurns: ['{turns}턴 만에 승리','{turns}ターンで勝利','Victory in {turns} turns','{turns}回合获胜'],
  lossTurns: ['{turns}턴 만에 패배','{turns}ターンで敗北','Defeat in {turns} turns','{turns}回合落败'],
  totalTurns: ['총 진행 턴 수 · {turns}','総ターン数 · {turns}','Total turns · {turns}','总回合数 · {turns}'],
  winTime: ['승리까지의 시간 · {time}','勝利までの時間 · {time}','Time to victory · {time}','获胜用时 · {time}'],
  matchTime: ['대전 시간 · {time}','対戦時間 · {time}','Match time · {time}','对局用时 · {time}'],
  recordUnavailable: ['이전 버전의 기록 정보 없음','旧バージョンの記録なし','Record unavailable for this older match','旧版本对局无记录'],

  inferenceContradiction: ['CPU 추론에 모순이 감지되어 행동을 중단했습니다. 메뉴에서 재시작할 수 있습니다.','CPUの推論に矛盾を検出したため、行動を停止しました。メニューから再スタートできます。','CPU inference is inconsistent. Actions stopped; restart from the menu.','CPU推理出现矛盾，已停止行动。可从菜单重新开始。'],
  explorationExhausted: ['자기 지뢰를 제외하고 탐색하거나 내 마커를 제거해 확보할 수 있는 칸이 없습니다.','自分の地雷を除き、探索できるマスも自分のマーカー解除で確保できるマスもありません。','No cells remain to explore or recover by removing your markers, excluding your own mines.','排除自身地雷后，已无可探索或通过移除自身标记恢复的格子。'],
  brand: ['턴제 지뢰찾기','ターン制マインスイーパー','Turn-based minesweeper','回合制扫雷'],
  gameName: ['지뢰 대전','マインデュエル','Mine Duel','地雷对决'],
  menu: ['메뉴','メニュー','Menu','菜单'], rules: ['규칙 설명','ルール','Rules','游戏规则'],
  restart: ['재시작','再スタート','Restart','重新开始'], language: ['언어 선택','言語を選択','Language','选择语言'],
  close: ['닫기','閉じる','Close','关闭'], cancel: ['취소','キャンセル','Cancel','取消'], start: ['게임 시작','ゲーム開始','Start game','开始游戏'],
  guide: ['플레이 가이드','遊び方','How to play','玩法指南'], intro: ['상대의 지뢰를 추리하고 마지막까지 살아남으세요!','相手の地雷を推理して、最後まで生き残ろう！','Outsmart your opponent and survive to the end!','推理对手的地雷位置，生存到最后！'],
  difficultyTitle: ['CPU 난이도','CPUの難易度','CPU difficulty','CPU难度'],
  easy: ['쉬움','かんたん','Easy','简单'], normal: ['보통','ふつう','Normal','普通'], hard: ['어려움','むずかしい','Hard','困难'],
  mistake: ['실수 {rate}%','ミス {rate}%','Mistakes {rate}%','失误 {rate}%'],
  player: ['플레이어','プレイヤー','Player','玩家'], cpu: ['CPU','CPU','CPU','CPU'],
  myTurn: ['내 차례','あなたの番','Your turn','你的回合'], cpuTurn: ['CPU 차례','CPUの番','CPU turn','CPU回合'],
  turn: ['{turn}턴 · {side}','ターン{turn} · {side}','Turn {turn} · {side}','第{turn}回合 · {side}'],
  'phase.opening-reveal': ['게임 준비 · 안전한 시작 칸 선택','準備 · 安全な開始マスを選択','Setup · Choose a safe starting cell','准备 · 选择安全起始格'],
  'phase.opening-mine': ['게임 준비 · 첫 지뢰 설치','準備 · 最初の地雷を設置','Setup · Place your first mine','准备 · 放置第一枚地雷'],
  'phase.explore': ['01 · 한 칸 탐색','01 · 1マスを探索','01 · Explore one cell','01 · 探索一格'],
  'phase.place-mine': ['02 · 지뢰 설치','02 · 地雷を設置','02 · Place a mine','02 · 放置地雷'],
  'phase.end-turn': ['03 · 마커 관리 또는 턴 종료','03 · マーカー操作・ターン終了','03 · Manage markers or end turn','03 · 管理标记或结束回合'],
  'phase.finished': ['게임 종료','ゲーム終了','Game over','游戏结束'],
  counts: ['내 지뢰 {player} · CPU 지뢰 {cpu}','自分の地雷 {player} · CPUの地雷 {cpu}','Your mines {player} · CPU mines {cpu}','你的地雷 {player} · CPU地雷 {cpu}'],
  budget: ['마커 {remaining}/{limit}','マーカー {remaining}/{limit}','Markers {remaining}/{limit}','标记 {remaining}/{limit}'],
  noMarker: ['마커 설치 불가','マーカー設置不可','Markers unavailable','无法放置标记'],
  explore: ['탐색','探索','Explore','探索'], mine: ['지뢰 설치','地雷設置','Place mine','放置地雷'], marker: ['마커 설치','マーカー設置','Place marker','放置标记'], remove: ['마커 제거','マーカー解除','Remove marker','移除标记'], endTurn: ['턴 종료','ターン終了','End turn','结束回合'],
  myExplore: ['내 탐색','自分の探索','Your reveals','你的探索'], cpuExplore: ['CPU 탐색','CPUの探索','CPU reveals','CPU探索'],
  ownMine: ['내 지뢰','自分の地雷','Your mine','你的地雷'], ownMarker: ['내 마커','自分のマーカー','Your marker','你的标记'], cpuMarker: ['CPU 마커','CPUのマーカー','CPU marker','CPU标记'],
  hidden: ['미공개','未探索','Unrevealed','未揭开'], explosion: ['지뢰 폭발','地雷が爆発','Mine exploded','地雷爆炸'],
  revealed: ['{owner}, 숫자 {number}','{owner}、数字 {number}','{owner}, number {number}','{owner}，数字 {number}'],
  cell: ['{row}행 {column}열, {details}','{row}行{column}列、{details}','Row {row}, column {column}, {details}','第{row}行第{column}列，{details}'],
  status: ['게임 상태','ゲーム状況','Game status','游戏状态'], board: ['게임 보드','ゲーム盤','Game board','游戏棋盘'], boardSize: ['8×8 보드','8×8の盤面','8×8 board','8×8棋盘'], controls: ['게임 조작','ゲーム操作','Game controls','游戏操作'], scrollRules: ['게임 규칙, 세로 스크롤 가능','ルール（縦スクロール可）','Game rules, scroll vertically','游戏规则，可上下滚动'],
  win: ['승리!','勝利！','You win!','胜利！'], loss: ['패배!','敗北！','You lose!','失败！'], draw: ['무승부','引き分け','Draw','平局'], turnsPlayed: ['진행한 턴 · {turn}','経過ターン · {turn}','Turns played · {turn}','已进行回合 · {turn}'],
  restartTitle: ['게임 재시작','ゲームを再スタート','Restart game','重新开始游戏'], restartBody: ['현재 게임을 종료하고 새 게임을 시작하시겠습니까?\n진행 중인 게임은 복구할 수 없습니다.','現在のゲームを終了して、新しいゲームを始めますか？\n現在の進行状況は復元できません。','End this game and start a new one?\nYour current progress cannot be restored.','结束当前游戏并开始新游戏吗？\n当前进度无法恢复。'],
  updateTitle: ['새 버전 안내','アップデートのお知らせ','Update available','有新版本'], updateBody: ['새 버전이 배포되었습니다. 새로고침하여 업데이트하시겠습니까?','新しいバージョンが公開されました。再読み込みして更新しますか？','A new version is available. Reload to update?','新版本已发布。是否刷新页面进行更新？'], later: ['나중에','あとで','Later','稍后'], update: ['업데이트','更新する','Update','更新'],
  initial: ['시작할 칸을 선택하세요. 첫 칸은 안전하게 공개됩니다.','開始マスを選んでください。最初のマスは安全です。','Choose your starting cell. It is safe to reveal.','请选择起始格。第一格保证安全。'],
  'mode.explore': ['마커가 없는 미공개 칸을 탐색하세요. 내 지뢰도 위험합니다.','マーカーのない未探索マスを選んでください。自分の地雷も危険です。','Explore an unmarked hidden cell. Your own mines are dangerous too.','探索没有标记的未揭开格。自己的地雷也很危险。'],
  'mode.mine': ['마커가 없는 미공개 칸에 지뢰를 설치하세요.','マーカーのない未探索マスに地雷を設置してください。','Place a mine in an unmarked hidden cell.','在没有标记的未揭开格放置地雷。'],
  'mode.marker': ['미공개 칸에 마커를 설치하세요. 지뢰 위에도 설치할 수 있습니다.','未探索マスにマーカーを設置してください。地雷の上にも設置できます。','Mark a hidden cell. You can mark a cell with a mine.','在未揭开的格子上放置标记。已有地雷的格子也可以标记。'],
  'mode.remove': ['제거할 내 마커를 선택하세요.','解除する自分のマーカーを選んでください。','Choose one of your markers to remove.','请选择要移除的自己的标记。'],
  invalidSettings: ['잘못된 게임 설정','ゲーム設定が無効です','Invalid game settings','游戏设置无效'], invalidViewer: ['잘못된 관측자','観測者が無効です','Invalid observer','观察者无效'],
  invalidExplore: ['자기 지뢰와 마커가 없는 미공개 칸을 선택하세요.','自分の地雷とマーカーがない未探索マスを選んでください。','Choose a hidden cell without your mine or a marker.','请选择没有自身地雷和标记的未揭开格。'],
  playerHit: ['플레이어가 지뢰를 밟았습니다.','プレイヤーが地雷を踏みました。','You stepped on a mine.','玩家踩中了地雷。'], cpuHit: ['CPU가 지뢰를 밟았습니다.','CPUが地雷を踏みました。','CPU stepped on a mine.','CPU踩中了地雷。'],
  safe: ['안전합니다! 한 칸을 공개했습니다.','安全です！1マスを開きました。','Safe! One cell revealed.','安全！已揭开一格。'],
  invalidMine: ['여기에는 지뢰를 설치할 수 없습니다. 다른 칸을 선택하세요.','ここには地雷を設置できません。別のマスを選んでください。','You cannot place a mine here. Choose another cell.','这里不能放置地雷，请选择其他格子。'],
  minePlaced: ['지뢰를 설치했습니다. 공개된 숫자를 갱신했습니다.','地雷を設置しました。公開済みの数字を更新しました。','Mine placed. Revealed numbers updated.','地雷已放置，已揭开格的数字已更新。'], cpuMinePlaced: ['CPU가 지뢰를 설치했습니다. 숫자를 갱신했습니다.','CPUが地雷を設置しました。数字を更新しました。','CPU placed a mine. Numbers updated.','CPU已放置地雷，数字已更新。'],
  invalidMarker: ['마커를 설치할 수 없습니다. 남은 횟수와 선택한 칸을 확인하세요.','マーカーを設置できません。残り回数とマスを確認してください。','Cannot place a marker. Check your allowance and the cell.','无法放置标记，请检查剩余次数和所选格子。'],
  markerPlaced: ['마커를 설치했습니다. 이 칸은 탐색과 새 지뢰 설치가 차단됩니다.','マーカーを設置しました。このマスは探索・地雷設置ができません。','Marker placed. This cell blocks exploration and new mines.','标记已放置。该格不能探索或放置新地雷。'],
  invalidRemoval: ['자신의 마커만 제거할 수 있습니다.','解除できるのは自分のマーカーだけです。','You can only remove your own markers.','只能移除自己的标记。'], markerRemoved: ['마커를 제거했습니다. 이번 턴의 설치 횟수는 복구되지 않습니다.','マーカーを解除しました。このターンの設置回数は戻りません。','Marker removed. This turn’s allowance is not restored.','标记已移除，本回合的放置次数不会恢复。'],
  invalidEnd: ['탐색과 지뢰 설치를 완료한 뒤 턴을 종료하세요.','探索と地雷設置を終えてからターンを終了してください。','Explore and place a mine before ending your turn.','请先完成探索和地雷放置，再结束回合。'], thinking: ['CPU가 생각 중입니다…','CPUが考えています…','CPU is thinking…','CPU正在思考…'], yourMove: ['내 차례입니다. 한 칸을 탐색하세요.','あなたの番です。1マスを探索してください。','Your turn. Explore one cell.','轮到你了，请探索一格。'],
  noExplore: ['마커가 없는 미공개 칸이 더 이상 없습니다.','マーカーのない未探索マスがありません。','No unmarked hidden cells remain.','已没有未标记的未揭开格。'], noMine: ['지뢰를 설치할 수 있는 칸이 더 이상 없습니다.','地雷を設置できるマスがありません。','No cells remain for the required mine placement.','已没有可放置地雷的格子。'], cpuNoExplore: ['CPU가 자신의 지뢰를 피해 탐색할 수 있는 칸이 없습니다.','CPUが自分の地雷を避けて探索できるマスがありません。','CPU has no cells to explore while avoiding its own mines.','CPU已没有可避开自身地雷进行探索的格子。'],
};
const ruleRows = [
  [['게임 진행','ゲームの流れ','Taking turns','游戏流程'], [
    ['플레이어와 CPU가 번갈아 한 칸을 탐색하고 지뢰 하나를 설치합니다.','プレイヤーとCPUが交互に1マスを探索し、地雷を1つ設置します。','You and CPU take turns exploring one cell and placing one mine.','玩家与CPU轮流探索一格，然后放置一枚地雷。'],
    ["상대 지뢰를 탐색하면 즉시 패배합니다. 자신의 지뢰가 있는 칸은 탐색할 수 없습니다.","相手の地雷を探索すると即敗北です。自分の地雷があるマスは探索できません。","Exploring an opponent mine means instant defeat. Cells containing your own mines cannot be explored.","探索到对手的地雷立即失败。不能探索含有自身地雷的格子。"],
    ["처음에는 양쪽이 안전한 칸을 하나씩 공개하고 첫 지뢰를 설치합니다. 초기 지뢰도 상대 지뢰와 중첩할 수 있습니다.","最初は双方が安全なマスを1つずつ開き、最初の地雷を設置します。初期地雷も相手の地雷と重ねられます。","At setup each side reveals a safe cell and places a first mine. Initial mines may overlap opponent mines too.","开始时双方各揭开一个安全格，再放置第一枚地雷。初始地雷也可与对手地雷重叠。"],
  ]],
  [['숫자와 탐색 색상','数字と探索の色','Numbers and cell colors','数字与探索颜色'], [
    ['숫자는 주변 8칸 중 지뢰가 존재하는 칸의 개수입니다.','数字は周囲8マスのうち、地雷のあるマスの数です。','Numbers count neighboring cells containing mines, out of the eight surrounding cells.','数字表示周围八格中有地雷的格子数量。'],
    ['지뢰가 추가되면 공개된 숫자도 즉시 바뀝니다. 0인 칸도 주변 칸을 자동 공개하지 않습니다.','地雷が増えると公開済みの数字もすぐに変わります。0でも周囲のマスは自動で開きません。','New mines update revealed numbers immediately. Zero cells do not automatically reveal neighbors.','新增地雷会立即更新已揭开格的数字。数字为0也不会自动揭开周围格子。'],
    ['파란 칸은 내 탐색, 빨간 칸은 CPU 탐색입니다. 숫자가 바뀌어도 색상은 유지됩니다.','青は自分が探索したマス、赤はCPUが探索したマスです。数字が変わっても色は変わりません。','Blue cells were explored by you; red cells by CPU. Their colors stay when numbers change.','蓝色格由你探索，红色格由CPU探索。数字变化时颜色保持不变。'],
  ]],
  [['지뢰 설치','地雷の設置','Placing mines','放置地雷'], [
    ['내 지뢰 위치는 항상 보이고 상대 지뢰는 숨겨져 있습니다.','自分の地雷は常に見えます。相手の地雷は見えません。','Your mines are always visible. Opponent mines are hidden.','自己的地雷始终可见，对手的地雷位置隐藏。'],
    ['일반 턴에는 상대 지뢰가 있는 칸에도 설치할 수 있습니다. 내 지뢰가 있는 칸에는 다시 설치할 수 없습니다.','通常ターンでは相手の地雷と同じマスにも設置できます。自分の地雷があるマスには再設置できません。','During normal turns you can overlap an opponent mine, but cannot place another mine on your own.','普通回合可以在对手有地雷的格子放置地雷，但不能在已有自己地雷的格子重复放置。'],
    ['중복 지뢰도 숫자 계산에서는 1칸으로 셉니다. 숫자가 증가하지 않을 수 있으며 별도 알림은 없습니다.','重なった地雷は数字の計算では1マスと数えます。数字が増えない場合もあり、特別な通知はありません。','Overlapping mines count as one occupied cell. Numbers may stay unchanged; there is no overlap alert.','重叠地雷只计为一个有雷格。数字可能不增加，也不会额外提示重叠。'],
    ['공개된 칸이나 마커가 있는 칸에는 설치할 수 없습니다.','探索済みのマスやマーカーのあるマスには設置できません。','You cannot place mines in revealed or marked cells.','已揭开或有标记的格子不能放置地雷。'],
  ]],
  [['마커','マーカー','Markers','标记'], [
    ['한 턴에 최대 1개 설치하며 설치는 선택 사항입니다. 탐색 전후와 지뢰 설치 단계 모두 관리할 수 있습니다.','1ターンに最大1つ設置でき、設置は任意です。探索の前後や地雷設置中にも操作できます。','Placing a marker is optional, limited to one new marker per turn. Manage markers before or after exploring, or while placing mines.','每回合最多新增一个标记，也可以不放置。探索前后及放雷阶段均可管理标记。'],
    ['양쪽 마커가 공유되며 내 마커만 제거할 수 있습니다.','双方のマーカーは見えます。解除できるのは自分のマーカーだけです。','Both sides can see all markers. You can only remove your own.','双方都能看到所有标记，但只能移除自己的标记。'],
    ['마커 칸은 탐색과 새 지뢰 설치를 막습니다. 이미 지뢰가 있어도 마커를 설치할 수 있습니다.','マーカーは探索と新しい地雷の設置を防ぎます。地雷があるマスにも設置できます。','Marked cells block exploration and new mines. You may mark cells that already contain mines.','有标记的格子无法探索或放置新地雷。已有地雷的格子也可以放置标记。'],
    ['제거해도 이번 턴의 신규 설치 횟수는 회복되지 않습니다.','解除しても、このターンの設置回数は戻りません。','Removing a marker does not restore this turn’s placement allowance.','移除标记不会恢复本回合的新增标记次数。'],
  ]],
  [['CPU 난이도','CPUの難易度','CPU difficulty','CPU难度'], [
    ["쉬움 40% · 보통 20% · 어려움 5%의 확률로 안전 확정 칸 대신 불확실 칸을 탐색합니다. 두 후보가 없으면 마커 횟수가 남아 있을 때 지뢰 확정 칸에 마커를 설치하고, 없으면 해당 칸을 탐색합니다. CPU는 숨겨진 상대 지뢰를 보지 않습니다.","かんたん40%・ふつう20%・むずかしい5%の確率で安全確定マスの代わりに不確実なマスを探索します。両候補がなければ残りマーカーで地雷確定マスを塞ぎ、使えなければそのマスを探索します。CPUは相手の隠れた地雷を見ません。","Mistake chances are Easy 40%, Normal 20%, Hard 5%: choose uncertain instead of confirmed safe cells. If neither remains, mark an inferred mine when allowance remains; otherwise explore it. CPU cannot see hidden opponent mines.","简单40%·普通20%·困难5%的概率会放弃确定安全格，选择不确定格。两者都没有时，若有剩余标记次数则标记推断有雷格，否则探索该格。CPU不查看对手隐藏的地雷。"],
  ]],
  [['승리 조건','勝敗の条件','Game results','胜负条件'], [
    ['CPU가 지뢰를 밟으면 승리합니다.','CPUが地雷を踏むと勝利です。','You win if CPU steps on a mine.','CPU踩雷则你获胜。'],
    ['내가 지뢰를 밟으면 패배합니다.','自分が地雷を踏むと敗北です。','You lose if you step on a mine.','你踩雷则失败。'],
    ['탐색 가능한 칸이 소진되면 무승부입니다. 필수 지뢰 설치가 불가능할 때도 무승부로 끝납니다.','探索できるマスがなくなると引き分けです。必要な地雷を設置できない場合も引き分けです。','The game ends in a draw when exploration is exhausted or required mine placement is impossible.','没有可探索的格子，或无法完成必须的地雷放置时，游戏以平局结束。'],
    ["자기 지뢰를 제외하고 탐색할 칸도 자기 마커를 제거해 복구할 칸도 없으면 무승부입니다. 모든 미공개 칸이 마커로 막히면 제거 가능 여부와 무관하게 즉시 무승부입니다. 상대 지뢰 칸만 남아도 탐색 후보가 있으면 탐색 결과로 승패를 판정합니다.","自分の地雷を除き探索候補も自分のマーカー解除で復元できる候補もなければ引き分けです。全未公開マスがマーカーで塞がれると解除可否にかかわらず即引き分けです。相手地雷しか残らなくても探索候補があれば探索結果で勝敗を判定します。","Draw if no exploration candidates remain even after removing your markers, excluding own mines. If all hidden cells are marked the draw is immediate. If only opponent mines remain but exploration is possible, the actual exploration result determines defeat.","排除自身地雷后，没有可探索或移除自身标记可恢复的格子时平局。全部未揭开格被标记时立即平局。即使只剩对手地雷，只要仍可探索就按实际探索结果判定胜负。"],
  ]],
];
ruleRows.forEach(([title, items], section) => {
  rows[`rules.${section}.title`] = title;
  items.forEach((row, item) => { rows[`rules.${section}.${item}`] = row; });
});
export const RULE_SECTIONS = ruleRows.map(([, items]) => items.length);
export const TRANSLATIONS = Object.freeze(Object.fromEntries(Object.keys(LANGUAGES).map((lang, i) => [lang, Object.freeze(Object.fromEntries(Object.entries(rows).map(([key, values]) => [key, values[i]])))])));
export function loadLanguage(storage) {
  try { const value = storage.getItem(LANGUAGE_KEY); return Object.hasOwn(LANGUAGES, value) ? value : null; } catch { return null; }
}
export function saveLanguage(storage, lang) { try { storage.setItem(LANGUAGE_KEY, lang); } catch { /* Private browsing can disable storage; the session still works. */ } }
export function translate(lang, key, params = {}, warn = false) {
  const value = TRANSLATIONS[lang]?.[key];
  if (!value && warn) console.warn(`Missing translation: ${lang}.${key}`);
  return (value || TRANSLATIONS.ko[key] || key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}
