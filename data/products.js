// 국내 인기 과자·음료·라면·키즈 간식 34종.
// 영양값은 각 제품의 실제 영양성분 표기값(총 내용량 기준)이다.
// 34종 전부 2026-11 제조사 공식 제품정보·식약처 식품영양성분 DB·공식 판매페이지 표기로 대조했다(출처: data/nutrition-sources.md).
// 제조사 개정에 따라 달라질 수 있다.
// bulk는 당류·지방을 뺀 나머지 무게를 원재료 비중대로 나누기 위한 상대 비중(합은 자동 정규화).
// short는 좁은 화면의 필터 칩에서만 쓰는 짧은 이름이다(목록 제목은 name).
export const CATEGORIES = [
  { key: 'snack', name: '과자', short: '과자', emoji: '🥨' },
  { key: 'drink', name: '음료', short: '음료', emoji: '🥤' },
  { key: 'noodle', name: '라면·간편식', short: '라면', emoji: '🍜' },
  { key: 'kids', name: '아기·키즈', short: '키즈', emoji: '🍼' },
];

export const PRODUCTS = [
  // ── 과자 ──────────────────────────────────────────────
  {
    id: 'banana-kick', name: '바나나킥', brand: '농심', category: 'snack', unit: 'g',
    weight: 75, kcal: 320, sodium: 100, sugar: 37, fat: 4.6, carbs: 66, protein: 3.2,
    ingredients: ['옥수수(콘밀)', '설탕', '팜올레인유', '바나나분말 1.6%', '정제소금', '강황추출분말', '향료'],
    bulk: [
      { kind: 'flour', label: '콘밀(옥수수)', sub: '옥수수·콘밀', share: 1.6 },
      { kind: 'fruit', label: '바나나분말 1.6%', sub: '바나나분말·난백분말', share: 0.45 },
      { kind: 'seasoning', label: '정제소금·향료', sub: '정제소금·강황추출분말·향료', share: 0.35 },
    ],
    note: '달콤한 바나나 향과 옥수수 콘밀',
  },
  {
    id: 'kkobuk-choco', name: '꼬북칩 초코츄러스', brand: '오리온', category: 'snack', unit: 'g',
    weight: 80, kcal: 426, sodium: 190, sugar: 26, fat: 22, carbs: 52, protein: 5,
    ingredients: ['밀가루(밀)', '다이제초콜릿', '식물성유지', '백설탕', '코코아분말', '빵가루', '츄러스맛시즈닝', '정제소금'],
    bulk: [
      { kind: 'flour', label: '밀가루', sub: '밀가루·곡류가공품', share: 2.4 },
      { kind: 'seasoning', label: '빵가루·츄러스맛시즈닝', sub: '빵가루·츄러스맛시즈닝·정제소금', share: 0.55 },
      { kind: 'cocoa', label: '다이제초콜릿', sub: '다이제초콜릿·코코아분말', share: 0.5 },
    ],
    note: '4겹으로 겹친 츄러스 모양 스낵',
  },
  {
    id: 'choco-songi', name: '초코송이', brand: '오리온', category: 'snack', unit: 'g',
    weight: 50, kcal: 266, sodium: 110, sugar: 20, fat: 14, carbs: 32, protein: 3,
    ingredients: ['밀가루', '백설탕', '코코아분말 4%', '식물성유지', '전지분유', '탈지분유', '유당', '코코아매스'],
    bulk: [
      { kind: 'flour', label: '밀가루(밀)', sub: '밀가루·옥수수전분', share: 1.5 },
      { kind: 'cocoa', label: '코코아분말·코코아매스', sub: '코코아원료 4%·소금', share: 0.8 },
      { kind: 'dairy', label: '전지분유·유당', sub: '전지분유·탈지분유·유당', share: 0.5 },
    ],
    note: '초코 아이스크림을 닮은 송이 모양',
  },
  {
    id: 'choco-heim', name: '쵸코하임', brand: '크라운', category: 'snack', unit: 'g',
    weight: 47, kcal: 250, sodium: 65, sugar: 17, fat: 14, carbs: 28, protein: 4,
    ingredients: ['밀가루', '가공유지', '백설탕', '유청분말', '혼합분유', '유당', '헤이즐넛페이스트 4.8%', '코코아가공품 2.9%', '쇼트닝', '정제소금'],
    bulk: [
      { kind: 'flour', label: '밀가루(밀)', sub: '밀가루·옥수수전분', share: 2.1 },
      { kind: 'dairy', label: '혼합분유·유청', sub: '혼합분유·유청분말·유당', share: 0.6 },
      { kind: 'cocoa', label: '헤이즐넛페이스트 4.8%', sub: '코코아가공품 2.9%·정제소금', share: 0.35 },
    ],
    note: '얇은 웨이퍼 사이 헤이즐넛 크림',
  },
  {
    id: 'postick', name: '포스틱', brand: '농심', category: 'snack', unit: 'g',
    weight: 84, kcal: 395, sodium: 530, sugar: 3, fat: 13, carbs: 64, protein: 3,
    ingredients: ['소맥분(밀)', '중숙감자 19%', '팜유', '감자맛조미분말(감자분말 3%)', '옥수수전분', '정제소금', '양파분말', '비프향시즈닝'],
    bulk: [
      { kind: 'flour', label: '소맥분(밀)', sub: '소맥분·밀가루', share: 1.8 },
      { kind: 'grain', label: '중숙감자 19%', sub: '중숙감자·감자플레이크', share: 1.1 },
      { kind: 'seasoning', label: '감자맛조미분말', sub: '조미분말·정제소금·양파', share: 0.6 },
    ],
    note: '감자 19%가 들어간 바삭한 스틱',
  },
  {
    id: 'honey-butter-chip', name: '허니버터칩', brand: '해태', category: 'snack', unit: 'g',
    weight: 60, kcal: 325, sodium: 230, sugar: 3, fat: 19, carbs: 35, protein: 3,
    ingredients: ['감자(미국산)', '혼합식용유(팜올레인유·해바라기유)', '허니버터맛시즈닝(과당·설탕·정제소금·탈지분유)', '가공버터 5.2%', '아카시아꿀분말 0.26%', '고메버터 0.3%'],
    bulk: [
      { kind: 'flour', label: '감자(생감자)', sub: '생감자 100%·감자전분', share: 2.2 },
      { kind: 'dairy', label: '가공버터 5.2%', sub: '가공버터·고메버터 0.3%', share: 0.6 },
      { kind: 'seasoning', label: '허니버터맛시즈닝', sub: '아카시아벌꿀분말 0.26%', share: 0.35 },
    ],
    note: '당류는 적고 지방이 많은 편',
  },
  {
    id: 'shrimp-cracker', name: '새우깡', brand: '농심', category: 'snack', unit: 'g',
    weight: 90, kcal: 465, sodium: 610, sugar: 5, fat: 25, carbs: 54, protein: 6,
    ingredients: ['소맥분(밀)', '전분', '새우살 6.6%', '설탕', '팜유', '정제소금', '염미시즈닝'],
    bulk: [
      { kind: 'flour', label: '밀가루·전분', sub: '소맥분·전분', share: 3.6 },
      { kind: 'seasoning', label: '새우조미분말', sub: '새우살 6.6%·정제소금', share: 0.8 },
    ],
    note: '국민 새우 스낵',
  },
  {
    id: 'pocachip', name: '포카칩', brand: '오리온', category: 'snack', unit: 'g',
    weight: 66, kcal: 377, sodium: 280, sugar: 0, fat: 25, carbs: 34, protein: 4,
    ingredients: ['생감자 91%(국산)', '팜올레인유', '정제소금', '양파분말', '치즈분말'],
    bulk: [
      { kind: 'flour', label: '생감자 91%', sub: '생감자·감자플레이크', share: 3.4 },
      { kind: 'seasoning', label: '양파·치즈분말', sub: '양파분말·치즈분말·정제소금', share: 0.6 },
    ],
    note: '생감자를 얇게 썰어 튀긴 칩',
  },
  {
    id: 'home-run-ball', name: '홈런볼', brand: '해태', category: 'snack', unit: 'g',
    weight: 46, kcal: 270, sodium: 70, sugar: 15, fat: 18, carbs: 23, protein: 3.6,
    ingredients: ['백설탕', '식물성유지', '혼합분유', '코코아분말 4%', '땅콩버터', '전란액', '마가린', '밀가루', '난백액', '정제소금'],
    bulk: [
      { kind: 'flour', label: '밀가루', sub: '밀가루·옥수수전분', share: 1.2 },
      { kind: 'cocoa', label: '코코아분말', sub: '코코아분말·초콜릿', share: 0.9 },
      { kind: 'dairy', label: '전지분유·난백', sub: '전지분유·난백분말', share: 0.5 },
    ],
    note: '초코 크림이 든 동그란 과자',
  },
  {
    id: 'oyes', name: '오예스', brand: '해태', category: 'snack', unit: 'g',
    weight: 30, kcal: 150, sodium: 60, sugar: 10, fat: 9, carbs: 15, protein: 2,
    ingredients: ['밀가루', '설탕', '코코아분말', '식물성유지', '혼합분유', '정제소금'],
    bulk: [
      { kind: 'flour', label: '밀가루', sub: '밀가루·옥수수전분', share: 1.1 },
      { kind: 'cocoa', label: '코코아분말', sub: '코코아분말·코코아매스', share: 0.75 },
      { kind: 'dairy', label: '혼합분유', sub: '혼합분유·유청분말', share: 0.35 },
    ],
    note: '한 개씩 포장된 초코 케이크',
  },
  {
    id: 'pepero', name: '빼빼로 오리지널', brand: '롯데', category: 'snack', unit: 'g',
    weight: 54, kcal: 270, sodium: 250, sugar: 15, fat: 12, carbs: 35, protein: 5,
    ingredients: ['밀가루', '설탕', '코코아분말', '식물성유지', '전지분유', '정제소금'],
    bulk: [
      { kind: 'flour', label: '밀가루', sub: '밀가루·옥수수전분', share: 1.7 },
      { kind: 'cocoa', label: '코코아분말', sub: '코코아분말·코코아매스', share: 0.8 },
      { kind: 'dairy', label: '전지분유', sub: '전지분유·유청분말', share: 0.4 },
    ],
    note: '가느다란 비스킷에 초콜릿 코팅',
  },

  // ── 음료 ──────────────────────────────────────────────
  {
    id: 'coca-cola', name: '코카콜라', brand: '코카콜라', category: 'drink', unit: 'ml',
    weight: 355, kcal: 152, sodium: 11, sugar: 38, fat: 0, carbs: 38, protein: 0,
    ingredients: ['정제수', '액상과당', '이산화탄소', '카라멜색소', '인산', '카페인'],
    bulk: [
      { kind: 'water', label: '정제수·탄산수', sub: '정제수·이산화탄소', share: 3.2 },
      { kind: 'seasoning', label: '카라멜색소·향료', sub: '카라멜색소·인산·카페인', share: 0.6 },
    ],
    note: '캔 한 개에 각설탕 12.7개분',
  },
  {
    id: 'coke-zero', name: '코카콜라 제로', brand: '코카콜라', category: 'drink', unit: 'ml',
    weight: 355, kcal: 0, sodium: 22, sugar: 0, fat: 0, carbs: 0, protein: 0,
    ingredients: ['정제수', '이산화탄소', '감미료(수크랄로스·아세설팜칼륨)', '카라멜색소', '카페인'],
    bulk: [
      { kind: 'water', label: '정제수·탄산수', sub: '정제수·이산화탄소', share: 3.6 },
      { kind: 'seasoning', label: '감미료·향료', sub: '수크랄로스·아세설팜칼륨·카페인', share: 0.4 },
    ],
    note: '당류 0g, 단맛은 감미료로',
  },
  {
    id: 'banana-milk', name: '바나나맛우유', brand: '빙그레', category: 'drink', unit: 'ml',
    weight: 240, kcal: 208, sodium: 110, sugar: 27, fat: 8, carbs: 27, protein: 7,
    ingredients: ['우유', '정제수', '설탕', '바나나농축액', '합성향료', '유화제'],
    bulk: [
      { kind: 'dairy', label: '우유·유가공품', sub: '원유·탈지분유', share: 2.1 },
      { kind: 'water', label: '정제수', sub: '정제수·유화제', share: 0.9 },
      { kind: 'fruit', label: '바나나농축액', sub: '바나나농축액·합성향료', share: 0.5 },
    ],
    note: '한 병에 각설탕 9개분',
  },
  {
    id: 'starbucks-double-shot', name: '스타벅스 더블샷 에스프레소&크림', brand: '스타벅스', category: 'drink', unit: 'ml',
    weight: 200, kcal: 115, sodium: 85, sugar: 19, fat: 2.4, carbs: 20, protein: 3.8,
    ingredients: ['정제수', '우유 16%', '커피추출액 11.22%', '설탕', '혼합분유', '유크림 1%', '커피파우더 0.4%'],
    bulk: [
      { kind: 'dairy', label: '우유·유크림', sub: '원유·유크림', share: 2.6 },
      { kind: 'water', label: '커피추출액', sub: '커피추출액·정제수', share: 1.1 },
    ],
    note: '출근길 커피 우유',
  },
  {
    id: 'starbucks-americano', name: '스타벅스 더블샷 아메리카노', brand: '스타벅스', category: 'drink', unit: 'ml',
    weight: 200, kcal: 20, sodium: 16, sugar: 0, fat: 0, carbs: 5, protein: 0,
    ingredients: ['정제수', '커피추출액'],
    bulk: [{ kind: 'water', label: '정제수·커피', sub: '정제수·커피추출액', share: 1 }],
    note: '당류·지방 0g',
  },
  {
    id: 'gatorade', name: '게토레이', brand: '동아오츠카', category: 'drink', unit: 'ml',
    weight: 600, kcal: 160, sodium: 300, sugar: 39, fat: 0, carbs: 40, protein: 0,
    ingredients: ['정제수', '설탕', '구연산', '구연산삼나트륨', '염화나트륨', '향료'],
    bulk: [
      { kind: 'water', label: '정제수', sub: '정제수·구연산', share: 4.6 },
      { kind: 'seasoning', label: '전해질·향료', sub: '구연산삼나트륨·염화나트륨·향료', share: 0.6 },
    ],
    note: '운동 후 한 병, 각설탕 13개분',
  },
  {
    id: 'choco-emong', name: '초코에몽', brand: '남양유업', category: 'drink', unit: 'ml',
    weight: 250, kcal: 205, sodium: 110, sugar: 27, fat: 6, carbs: 30, protein: 7.5,
    ingredients: ['원유', '코코아분말', '탈지분유', '유크림', '합성향료', '유화제'],
    bulk: [
      { kind: 'dairy', label: '원유·유크림', sub: '원유·유크림·탈지분유', share: 2.4 },
      { kind: 'water', label: '정제수·유화제', sub: '정제수·유화제', share: 0.8 },
      { kind: 'cocoa', label: '코코아분말', sub: '코코아분말·합성향료', share: 0.35 },
    ],
    note: '아이들이 좋아하는 초코 우유, 각설탕 9개분',
  },
  {
    id: 'sunkist-orange', name: '썬키스트 오렌지주스', brand: '썬키스트', category: 'drink', unit: 'ml',
    weight: 180, kcal: 85, sodium: 5, sugar: 18, fat: 0, carbs: 21, protein: 0,
    ingredients: ['오렌지과즙 100%', '비타민C'],
    bulk: [
      { kind: 'water', label: '과즙 수분', sub: '오렌지과즙 수분', share: 2.3 },
      { kind: 'fruit', label: '과즙 고형분', sub: '오렌지과즙·비타민C', share: 0.7 },
    ],
    note: '과즙 100%, 당류는 18g',
  },
  {
    id: 'pocari-sweat', name: '포카리스웨트', brand: '동아오츠카', category: 'drink', unit: 'ml',
    weight: 500, kcal: 120, sodium: 250, sugar: 29, fat: 0, carbs: 30, protein: 0,
    ingredients: ['정제수', '설탕', '구연산', '구연산삼나트륨', '염화칼륨', '향료'],
    bulk: [
      { kind: 'water', label: '정제수', sub: '정제수·구연산', share: 3.9 },
      { kind: 'seasoning', label: '전해질·향료', sub: '구연산삼나트륨·염화칼륨·향료', share: 0.5 },
    ],
    note: '이온 음료, 나트륨은 국자 1.1개',
  },

  // ── 라면·간편식 ────────────────────────────────────────
  {
    id: 'shin-ramyun', name: '신라면', brand: '농심', category: 'noodle', unit: 'g',
    weight: 120, kcal: 500, sodium: 1790, sugar: 4, fat: 16, carbs: 79, protein: 10,
    ingredients: ['소맥분', '팜유', '분말스프', '정제소금', '쇠고기맛분말', '건더기(표고·조미유부)'],
    bulk: [
      { kind: 'noodle', label: '소맥분(면발)', sub: '소맥분·팜유·전분', share: 6.2 },
      { kind: 'soup', label: '분말스프', sub: '분말스프·쇠고기맛분말·고추분', share: 2.6 },
      { kind: 'dried', label: '건더기', sub: '표고버섯·조미유부', share: 1.2 },
    ],
    note: '국물까지 먹으면 나트륨 국자 8.1개',
  },
  {
    id: 'buldak', name: '불닭볶음면', brand: '삼양', category: 'noodle', unit: 'g',
    weight: 140, kcal: 530, sodium: 1280, sugar: 7, fat: 16, carbs: 85, protein: 12,
    ingredients: ['소맥분', '팜유', '불닭소스', '정제소금', '닭고기맛분말', '치즈분말'],
    bulk: [
      { kind: 'noodle', label: '소맥분(면발)', sub: '소맥분·팜유', share: 6.4 },
      { kind: 'soup', label: '불닭소스', sub: '불닭소스·닭고기맛분말', share: 3 },
      { kind: 'dried', label: '건더기', sub: '김·조미분말', share: 1 },
    ],
    note: '매운 소스, 나트륨 국자 5.8개',
  },
  {
    id: 'jjapageti', name: '짜파게티', brand: '농심', category: 'noodle', unit: 'g',
    weight: 140, kcal: 610, sodium: 1100, sugar: 7, fat: 20, carbs: 96, protein: 11,
    ingredients: ['소맥분', '팜유', '짜장분말', '정제소금', '양파분말', '건더기(감자·양파)'],
    bulk: [
      { kind: 'noodle', label: '소맥분(면발)', sub: '소맥분·팜유', share: 6.2 },
      { kind: 'soup', label: '짜장분말', sub: '짜장분말·양파분말', share: 2.6 },
      { kind: 'dried', label: '건더기', sub: '감자·양파·조미유부', share: 1.2 },
    ],
    note: '지방 20g, 밥숟가락 2개',
  },
  {
    id: 'cup-noodle', name: '컵누들 매콤한맛', brand: '오뚜기', category: 'noodle', unit: 'g',
    weight: 37.8, kcal: 120, sodium: 890, sugar: 3, fat: 0, carbs: 29, protein: 1,
    ingredients: ['곤약면', '분말스프', '정제소금', '고추분', '표고버섯분말'],
    bulk: [
      { kind: 'noodle', label: '곤약면', sub: '곤약·전분', share: 2.2 },
      { kind: 'soup', label: '분말스프', sub: '분말스프·고추분', share: 1.1 },
    ],
    note: '저칼로리 컵누들, 그래도 나트륨은 국자 4개',
  },
  {
    id: 'bibim-myeon', name: '비빔면', brand: '팔도', category: 'noodle', unit: 'g',
    weight: 130, kcal: 525, sodium: 1090, sugar: 12, fat: 19, carbs: 80, protein: 9,
    ingredients: ['소맥분', '팜유', '양념장', '설탕', '정제소금', '참깨'],
    bulk: [
      { kind: 'noodle', label: '소맥분(면발)', sub: '소맥분·팜유', share: 6.4 },
      { kind: 'soup', label: '양념장', sub: '양념장·고추장분말', share: 2.4 },
      { kind: 'dried', label: '참깨·김', sub: '참깨·김·건더기', share: 1 },
    ],
    note: '여름철 비빔면, 당류 12g',
  },
  {
    id: 'haetban', name: '햇반', brand: 'CJ제일제당', category: 'noodle', unit: 'g',
    weight: 210, kcal: 315, sodium: 15, sugar: 0, fat: 1.5, carbs: 68, protein: 6,
    ingredients: ['국내산 쌀', '정제수'],
    bulk: [{ kind: 'grain', label: '쌀', sub: '국내산 쌀·정제수', share: 1 }],
    note: '나트륨 15mg, 거의 없는 수준',
  },
  {
    id: 'tuna-gimbap', name: '참치마요 삼각김밥', brand: 'GS25', category: 'noodle', unit: 'g',
    weight: 112, kcal: 224, sodium: 397, sugar: 1, fat: 8, carbs: 32, protein: 6,
    ingredients: ['쌀', '참치마요소스', '김', '단무지', '정제소금'],
    bulk: [
      { kind: 'grain', label: '밥(쌀)', sub: '쌀·정제수', share: 2.9 },
      { kind: 'soup', label: '참치마요소스', sub: '참치·마요네즈·양념', share: 1 },
      { kind: 'dried', label: '김·단무지', sub: '김·단무지', share: 0.4 },
    ],
    note: '편의점 삼각김밥 한 개',
  },

  // ── 아기·키즈 ─────────────────────────────────────────
  {
    id: 'pororo-barley', name: '뽀로로 보리차', brand: '팔도', category: 'kids', unit: 'ml',
    weight: 220, kcal: 0, sodium: 5, sugar: 0, fat: 0, carbs: 0, protein: 0,
    ingredients: ['정제수', '보리추출액'],
    bulk: [{ kind: 'water', label: '정제수·보리차', sub: '정제수·보리추출액', share: 1 }],
    note: '당류 0g, 아이 물 대용',
  },
  {
    id: 'pororo-apple', name: '뽀로로 사과맛', brand: '팔도', category: 'kids', unit: 'ml',
    weight: 235, kcal: 75, sodium: 30, sugar: 11, fat: 0, carbs: 20, protein: 0,
    ingredients: ['정제수', '사과농축액', '설탕', '구연산', '향료'],
    bulk: [
      { kind: 'water', label: '정제수', sub: '정제수·구연산', share: 2.4 },
      { kind: 'fruit', label: '사과농축액', sub: '사과농축액·향료', share: 0.9 },
    ],
    note: '한 병에 각설탕 3.7개분',
  },
  {
    id: 'yomi-tteokppong', name: '요미요미 유기농 쌀떡뻥 현미와보리', brand: '매일유업', category: 'kids', unit: 'g',
    weight: 30, kcal: 110, sodium: 15, sugar: 0, fat: 0, carbs: 26, protein: 2,
    ingredients: ['유기농 쌀가루', '유기농 현미가루', '칼슘', '비타민B1'],
    bulk: [
      { kind: 'grain', label: '유기농 쌀가루', sub: '쌀가루·현미가루', share: 2.6 },
      { kind: 'seasoning', label: '영양강화제', sub: '칼슘·비타민B1', share: 0.35 },
    ],
    note: '첫 간식용 떡뻥',
  },
  {
    id: 'baby-cheese', name: '아기치즈 1단계', brand: '서울우유', category: 'kids', unit: 'g',
    weight: 18, kcal: 61, sodium: 47, sugar: 0, fat: 5.2, carbs: 0, protein: 3.5,
    ingredients: ['원유', '치즈', '유청분말', '비타민D'],
    bulk: [
      { kind: 'dairy', label: '치즈·원유', sub: '원유·자연치즈', share: 3.4 },
      { kind: 'salt', label: '유청·영양강화', sub: '유청분말·비타민D', share: 0.4 },
    ],
    note: '한 장(18g)에 나트륨 47mg',
  },
  {
    id: 'maeil-milk', name: '매일우유 멸균우유', brand: '매일유업', category: 'kids', unit: 'ml',
    weight: 200, kcal: 125, sodium: 100, sugar: 9, fat: 7, carbs: 9, protein: 6,
    ingredients: ['원유 100%'],
    bulk: [{ kind: 'dairy', label: '원유', sub: '원유 100%', share: 1 }],
    note: '유당이 당류로 표기되는 우유',
  },
  {
    id: 'iyum-apple-ring', name: '아이얌 유기농 사과 떡뻥', brand: '아이얌', category: 'kids', unit: 'g',
    weight: 30, kcal: 110, sodium: 5, sugar: 0, fat: 0.2, carbs: 25, protein: 2,
    ingredients: ['유기농 쌀', '유기농 사과즙', '비타민C'],
    bulk: [
      { kind: 'grain', label: '쌀가루', sub: '쌀가루·옥수수전분', share: 2.4 },
      { kind: 'fruit', label: '사과농축액', sub: '사과농축액·비타민C', share: 0.5 },
    ],
    note: '손에 쥐고 먹는 사과 떡뻥',
  },
  {
    id: 'kids-yogurt', name: '뽀로로와 친구들 요구르트', brand: '빙그레', category: 'kids', unit: 'ml',
    weight: 80, kcal: 50, sodium: 25, sugar: 7, fat: 0, carbs: 11, protein: 1,
    ingredients: ['발효유', '설탕', '과일농축액', '유산균'],
    bulk: [
      { kind: 'dairy', label: '발효유', sub: '발효유·유산균', share: 1.1 },
      { kind: 'fruit', label: '과일농축액', sub: '과일농축액·설탕', share: 0.4 },
    ],
    note: '한 병에 각설탕 2.3개분',
  },
];

export const productById = (id) => PRODUCTS.find((p) => p.id === id) ?? null;
export const categoryName = (key) => CATEGORIES.find((c) => c.key === key)?.name ?? key;
