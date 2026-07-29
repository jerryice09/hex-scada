# 변경 내역 — 위험 경보음 추가

이 문서는 이번 작업(위험 등급 사고 발생 시 경보음 알림)에서 무엇이,
어느 파일에, 왜 바뀌었는지 정리한 것입니다.

## 요청 사항
1. 새로운 위험(danger) 등급 사고가 발생해 `sopQueue`에 추가되는 시점에 경고음 재생
2. 브라우저 자동재생 정책 대응 — 사용자의 첫 클릭/터치 이후에만 소리 재생
3. SOP 팝업이 열릴 때 1회, 미확인 상태가 30초 이상 지속되면 반복 재생
4. 음소거 토글을 헤더에 추가 (로컬 state로만 유지, 저장 불필요)

## 변경된 파일

### 1. `src/utils/alertSound.js` (신규 파일)
- Web Audio API로 2음(880Hz → 1046.5Hz) 비프음을 생성하는 `playAlertSound()`
- 사용자의 첫 클릭/터치/키 입력을 감지해 `AudioContext`를 unlock하는 `initAlertSound()`
- unlock 여부를 확인하는 `isAlertSoundUnlocked()`

### 2. `src/App.jsx` (수정)
| 위치 | 변경 내용 |
|---|---|
| 상단 import | `alertSound.js` 함수들과 `Volume2`/`VolumeX` 아이콘 import 추가 |
| state 선언부 | `soundMuted` state, `soundMutedRef`, `sopRepeatTimerRef` 추가 |
| 마운트 useEffect | `initAlertSound()` 호출해 소리 unlock 리스너 등록 |
| 사고 등록 useEffect | 새 위험 사고가 `sopQueue`에 들어갈 때 `playAlertSound()` 1회 호출 |
| 신규 useEffect | `activeSop`가 세팅되면(모달 열릴 때) 1회 재생 + 30초 간격 반복 재생, 확인 시 정지 |
| 헤더 UI | 🔊/🔇 음소거 토글 버튼 추가 |

## 확인한 사항
- `npm install` + `npx vite build` 정상 빌드 확인 완료

## 적용 방법
`src/App.jsx`를 통째로 교체하고, `src/utils/alertSound.js`를 새로 추가하면 됩니다.
(자세한 절차는 대화 내용 참고)
