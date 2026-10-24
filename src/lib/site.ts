// 홈페이지에 표시되는 단지 정보. 실제 단지명·연락처·약관으로 바꿔서 쓴다.
// 세대 구성 수치는 Supabase units 표(220세대) 기준.

export const SITE = {
  name: "리버뷰 레지던스",
  nameNote: "가칭",
  tagline: "강과 공원 사이, 매일이 쉼이 되는 집",
  phone: "1600-0000",
  hours: "매일 10:00 ~ 18:00",
  privacy: {
    items: "이름, 연락처, 관심 타입, 문의 내용",
    purpose: "분양 상담 안내 연락",
    retention: "문의일로부터 1년 (요청 시 즉시 파기)",
  },
};

export const OVERVIEW = [
  { label: "총 세대수", value: "220세대" },
  { label: "규모", value: "3개 동 · 최고 22층" },
  { label: "주택 타입", value: "7개 타입" },
  { label: "전용면적", value: "59 ~ 114㎡" },
];

// 관심타입 선택지 겸 타입 소개 (units 표의 타입·면적·세대수)
export const UNIT_TYPES = [
  { type: "59A", area: 59, count: 37, note: "실속형 3룸" },
  { type: "59B", area: 60, count: 18, note: "판상형 3룸" },
  { type: "74A", area: 74, count: 41, note: "신혼·3인 가구" },
  { type: "84A", area: 84, count: 30, note: "대표 평형, 4베이" },
  { type: "84B", area: 85, count: 29, note: "타워형, 조망 특화" },
  { type: "102A", area: 102, count: 30, note: "넓은 거실·드레스룸" },
  { type: "114A", area: 114, count: 35, note: "최상위 평형" },
];
