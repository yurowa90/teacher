# 구글 시트 구조 (탭 · 열)

`setupSheets` 실행 시 아래 탭이 자동 생성됩니다. 열 이름(첫 행)은 그대로 두고
값만 편집하세요. 자료·질문은 **`Activities`** 탭에서 관리합니다.

## Module (단원 메타) — 열: `key`, `value`

| key | value 예시 |
|-----|-----------|
| title | 단원 제목 |
| book | 들어갈 책 이름 |
| subject | 통합과학2 |
| standard | [10통과2-01-02] |
| intro | 단원/도서 맥락 안내 문장 |

## Activities (자료 + 질문) — 열: `code`, `level`, `type`, `title`, `prompt`, `resource`

| 열 | 설명 |
|----|------|
| code | 활동 코드(고유). 예: A1, B2 — 진행표·저장의 키로 쓰임 |
| level | 수준 라벨. 예: A형 비계, B형 표준 |
| type | 유형 태그(자유). 예: keyword, data, essay, reflection |
| title | 활동 제목 |
| prompt | 발문(질문) |
| resource | (선택) 보조 자료. 아래 두 형식 지원 |

`resource` 열 형식:

- **일반 텍스트**: 그대로 입력하면 학생 화면에 텍스트 블록으로 표시됩니다.
- **표(JSON)**: 아래처럼 한 셀에 JSON을 붙여넣습니다.

```json
{"type":"table","caption":"세대별 몸색 형질 빈도 변화","headers":["세대","밝은 몸색 비율","어두운 몸색 비율"],"rows":[["1세대","80%","20%"],["5세대","65%","35%"]]}
```

## Rubric (루브릭) — 열: `label`, `description`

| label | description |
|-------|-------------|
| 개념 정확성 | 핵심 개념을 정확히 구분하고 연결하는가 |
| 논증 구조 | 주장-근거-결론 구조가 명확한가 |

> 리뷰 점수는 `label`을 키로 저장됩니다. 채점 후 라벨을 바꾸면 이전 점수 연결이 끊길 수 있으니 주의하세요.

## Misconceptions (오개념) — 열: `label`, `feedback`

| label | feedback |
|-------|----------|
| 목적론: 필요해서 생겼다 | 유리한 형질을 가진 개체가 더 많이 남은 과정으로 설명하십시오. |

## Students (익명 학생) — 열: `studentId`, `segment`

| studentId | segment |
|-----------|---------|
| S-001 | standard |
| S-003 | scaffold |

> 실명·학번은 넣지 마세요. 익명 라벨만 사용합니다. (비우면 앱이 S-001~S-005 기본값 사용)

## Responses (앱이 저장) — 열: `studentId`, `code`, `content`, `updatedAt`

학생 답안이 `(studentId, code)` 단위로 저장됩니다. 직접 편집하지 않아도 됩니다.

## Reviews (앱이 저장) — 열: `studentId`, `code`, `scores`, `misconceptions`, `feedback`, `updatedAt`

교사 리뷰가 저장됩니다. `scores`는 `{"개념 정확성":4}` 형태 JSON,
`misconceptions`는 `["목적론"]` 형태 JSON 배열로 기록됩니다.
