// 국내 인기 과자·음료·라면·키즈 간식 61종(2026-11-28 27종 추가).
// 영양값은 각 제품의 실제 영양성분 표기값(총 내용량 기준)이다.
// 전 제품 2026-11 제조사 공식 제품정보·식약처 식품영양성분 DB(K-FIND)·공식 판매페이지 표기로 대조했다(출처: data/nutrition-sources.md).
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

  // ── 2026-11-28 추가 27종 (해태·팔도 공식 제품정보 + 식약처 K-FIND 영양성분 DB) ─────
  {
    id: 'ace', name: '에이스', brand: '해태', category: 'snack', unit: 'g',
    weight: 121, kcal: 653, sodium: 593, sugar: 9.7, fat: 36.3, carbs: 73.8, protein: 8.5,
    ingredients: ['밀가루[밀(미국산)]', '쇼트닝[팜유(말레이시아산), 가공유지(에스테르화유:팜올레인유(말레이시아산), 팜유(말레이시아산)), 동물성유지]', '혼합식용유[팜올레인유(말레이시아산), 팜유(말레이시아산), 올레오레진로즈메리]', '설탕', '곡류가공품', '포도당', '기타가공품', '전지분유', '정제소금', '천일염', '가공유크림', '팽창제'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '버터 풍미 가득한 크래커', itemNo: 35,
  },
  {
    id: 'guun-gamja', name: '구운감자', brand: '해태', category: 'snack', unit: 'g',
    weight: 27, kcal: 130, sodium: 210, sugar: 2, fat: 6, carbs: 19, protein: 0.7,
    ingredients: ['감자전분플러스{감자전분1(독일산), 감자전분2(감자:국내산)}', '전분가공품(태국산:타피오카전분, 설탕, 정제소금)', '혼합식용유{팜올레인유(말레이시아산), 팜유(말레이시아산), 올레오레진로즈메리}', '건조감자분말(미국산)', '곡류가공품1(소맥분, 찹쌀, 전분)', '마가린(팜유, 가공유지, 팜올레인유, 채종유, 가공버터)', '쇼트닝', '전분1', '설탕', '전분2', '가공연유', '당류가공품'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '군것질 대신 구운 감자', itemNo: 36,
  },
  {
    id: 'butterring-gold', name: '버터링 골드', brand: '해태', category: 'snack', unit: 'g',
    weight: 194, kcal: 1034, sodium: 421, sugar: 38.8, fat: 52.4, carbs: 129.2, protein: 12.9,
    ingredients: ['밀가루{밀(미국산)}', '쇼트닝{팜올레인유(말레이시아산), 팜스테아린유(말레이시아산), 올레오레진로즈메리}', '설탕', '전란액(국산)', '발효가공버터', '마가린', '가공치즈', '기타가공품', '당류가공품', '유화제', '팽창제', '정제소금'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '발효버터 향의 골드 쿠키', itemNo: 37,
  },
  {
    id: 'butterring-esh', name: '버터링 with 에쉬레버터', brand: '해태', category: 'snack', unit: 'g',
    weight: 86, kcal: 458, sodium: 187, sugar: 17.2, fat: 25.8, carbs: 51.6, protein: 5.7,
    ingredients: ['밀가루{밀(미국산)}', '쇼트닝{팜올레인유(말레이시아산), 팜스테아린유(말레이시아산), 올레오레진로즈메리}', '설탕', '전란액(국산)', '발효가공버터', '마가린', '가공치즈', '기타가공품', '당류가공품', '유화제', '팽창제', '정제소금'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '에쉬레버터를 넣은 버터링', itemNo: 38,
  },
  {
    id: 'sable', name: '사브레', brand: '해태', category: 'snack', unit: 'g',
    weight: 252, kcal: 1235, sodium: 479, sugar: 70.6, fat: 50.4, carbs: 181.4, protein: 13.4,
    ingredients: ['밀가루{밀(미국산)}', '기타설탕(설탕,전분)', '쇼트닝{팜유류1(말레이시아산),팜유류2(말레이시아산),올레오레진로즈메리}', '전란액(국산)', '코코아분말1(싱가포르산)', '가공버터', '코코아분말2(싱가포르산)', '기타가공품', '팽창제', '레시틴', '향료제제(프로필렌글리콜,향료,정제수,트리아세틴,젖산)', '정제소금'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '담백한 프렌치 사브레', itemNo: 39,
  },
  {
    id: 'cream-wafer', name: '크림웨하스', brand: '해태', category: 'snack', unit: 'g',
    weight: 50, kcal: 255, sodium: 100, sugar: 14, fat: 13, carbs: 32, protein: 3,
    ingredients: ['밀가루{밀(미국산)}', '쇼트닝[가공유지{팜몰레인에스테르화유(팜올레인유:말레이시아산)},채종유(호주산)]', '기타설탕(설탕,전분)', '포도당', '조제분[전지지방밀{팜유(말레이시아산)}혼합가공전지분유{전지분유(네덜란드산)}]', '유청단백분말', '전란분', '생크림분말{유크림(국산)}', '정제소금', '산도조절제', '바닐린', '유화제'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '얇은 웨이퍼 사이 크림', itemNo: 40,
  },
  {
    id: 'strawberry-wafer', name: '딸기웨하스', brand: '해태', category: 'snack', unit: 'g',
    weight: 50, kcal: 245, sodium: 85, sugar: 14, fat: 11, carbs: 34, protein: 3,
    ingredients: ['밀가루{밀(미국산)}', '쇼트닝[가공유지{팜몰레인에스테르화유(팜올레인유:말레이시아산)},채종유(호주산)]', '기타설탕(설탕,전분)', '포도당', '조제분[전지지방밀{팜유(말레이시아산)}혼합가공전지분유{전지분유(네덜란드산)}]', '유청단백분말', '전란분', '생크림분말{유크림(국산)}', '정제소금', '산도조절제', '바닐린', '유화제'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '딸기 크림 웨하스', itemNo: 41,
  },
  {
    id: 'rolypoly', name: '롤리폴리', brand: '해태', category: 'snack', unit: 'g',
    weight: 62, kcal: 295, sodium: 110, sugar: 29, fat: 10, carbs: 45, protein: 6,
    ingredients: ['준초콜릿[설탕,가공유지{가공유지(팜핵에스테르화유(팜핵유(말레이시아산)))},혼합분유1{전지분유(네덜란드산)},혼합분유2,코코아분말1]', '밀가루{밀(미국산)}', '설탕', '포도당', '당류가공품', '땅콩페이스트{땅콩(중국산)}', '코코아분말2', '두류가공품', '전란분', '정제소금', '코코아분말3', '유화제'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '돌돌 말아 구운 초코 과자', itemNo: 42,
  },
  {
    id: 'oyes-mini', name: '오예스 미니 쿠키앤크림', brand: '해태', category: 'snack', unit: 'g',
    weight: 192, kcal: 927, sodium: 417, sugar: 63.9, fat: 51.3, carbs: 103.7, protein: 12.8,
    ingredients: ['밀가루[밀(미국산)]', '쇼트닝[팜유(말레이시아산), 가공유지(에스테르화유:팜올레인유(말레이시아산), 팜유(말레이시아산)), 동물성유지]', '혼합식용유[팜올레인유(말레이시아산), 팜유(말레이시아산), 올레오레진로즈메리]', '설탕', '곡류가공품', '포도당', '기타가공품', '전지분유', '정제소금', '천일염', '가공유크림', '팽창제'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '한 입 크기 초코 케이크', itemNo: 43,
  },
  {
    id: 'oyes-coldbrew', name: '오예스 콜드브루', brand: '해태', category: 'snack', unit: 'g',
    weight: 360, kcal: 1800, sodium: 1199, sugar: 119.9, fat: 96.1, carbs: 204.1, protein: 24,
    ingredients: ['밀가루{밀(미국산)}', '준초콜릿{설탕,대두유(외국산:네덜란드,러시아,태국 등),코코아프리퍼레이션(외국산:네덜란드,벨기에,독일),코코아분말,팜올레인유}', '캔디류{기타설탕,포도당,아라비아검,합성향료,혼합제제1(자주색고구마색소,홍화황색소,구연산,말토덱스트린)}', '설탕', '혼합식용유{팜올레인유(말레이시아산),팜유(말레이시아산),올레오레진로즈메리}', '곡류가공품', '쇼트닝', '가공버터', '밀키페이스트', '볶음참깨', '가공치즈', '정제소금'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '콜드브루 향 초코 케이크', itemNo: 44,
  },
  {
    id: 'pocky', name: '포키', brand: '해태', category: 'snack', unit: 'g',
    weight: 46, kcal: 225, sodium: 160, sugar: 15, fat: 10, carbs: 30, protein: 4,
    ingredients: ['밀가루{밀(미국산)}', '쇼트닝[가공유지{팜몰레인에스테르화유(팜올레인유:말레이시아산)},채종유(호주산)]', '기타설탕(설탕,전분)', '포도당', '조제분[전지지방밀{팜유(말레이시아산)}혼합가공전지분유{전지분유(네덜란드산)}]', '유청단백분말', '전란분', '생크림분말{유크림(국산)}', '정제소금', '산도조절제', '바닐린', '유화제'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '가느다란 초콜릿 막대', itemNo: 45,
  },
  {
    id: 'pocky-thin', name: '포키 극세', brand: '해태', category: 'snack', unit: 'g',
    weight: 44, kcal: 225, sodium: 150, sugar: 15, fat: 11, carbs: 28, protein: 4,
    ingredients: ['밀가루{밀(미국산)}', '쇼트닝[가공유지{팜몰레인에스테르화유(팜올레인유:말레이시아산)},채종유(호주산)]', '기타설탕(설탕,전분)', '포도당', '조제분[전지지방밀{팜유(말레이시아산)}혼합가공전지분유{전지분유(네덜란드산)}]', '유청단백분말', '전란분', '생크림분말{유크림(국산)}', '정제소금', '산도조절제', '바닐린', '유화제'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '더 가는 포키', itemNo: 46,
  },
  {
    id: 'khanchuricon', name: '칸츄리콘', brand: '해태', category: 'snack', unit: 'g',
    weight: 90, kcal: 525, sodium: 720, sugar: 9, fat: 36, carbs: 48, protein: 3,
    ingredients: ['옥수수가루[옥수수{외국산(호주,미국,브라질 등)}]', '혼합식용유[팜올레인유(말레이시아산),고올레산해바라기유{외국산(우크라이나,아르헨티나,스페인 등)},해바라기유,토코페롤(혼합형)]', '전분가공품{찰옥수수(미국산)}', '복합조미식품(콘버터맛시즈닝)', '밀가루', '설탕', '정제소금', '산도조절제1', '물엿', '마가린', '산도조절제2', '팽창제'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '콘버터맛 옥수수 스낵', itemNo: 47,
  },
  {
    id: 'guun-yangpa', name: '구운양파', brand: '해태', category: 'snack', unit: 'g',
    weight: 60, kcal: 350, sodium: 260, sugar: 3, fat: 23, carbs: 33, protein: 3,
    ingredients: ['곡류가공품[옥수수]', '혼합식용유[팜올레인유(말레이시아산), 고올레산해바라기유, 해바라기유, 토코페롤(혼합형)]', '양파향미유[옥수수유, 양파추출물]', '천연파오일', '복합조미식품1[양파맛시즈닝]', '양파분말', '기타가공품[양파맛파우다]', '탄산칼슘', '복합조미식품2', '혼합제제[어니언플레이버]'],
    bulk: [{kind: 'flour', label: '옥수수·곡류가공품', sub: '옥수수·양파분말', share: 2.6}, {kind: 'oil', label: '식물성유지', sub: '팜올레인유·양파향미유', share: 1.2}, {kind: 'seasoning', label: '시즈닝·향료', sub: '양파맛시즈닝·천연파오일', share: 0.5}],
    note: '구운 양파 스낵', itemNo: 48,
  },
  {
    id: 'garubi-original', name: '가루비감자칩', brand: '해태', category: 'snack', unit: 'g',
    weight: 55, kcal: 320, sodium: 180, sugar: 1, fat: 21, carbs: 30, protein: 3,
    ingredients: ['감자전분플러스{감자전분1(독일산), 감자전분2(감자:국내산)}', '전분가공품(태국산:타피오카전분, 설탕, 정제소금)', '혼합식용유{팜올레인유(말레이시아산), 팜유(말레이시아산), 올레오레진로즈메리}', '건조감자분말(미국산)', '곡류가공품1(소맥분, 찹쌀, 전분)', '마가린(팜유, 가공유지, 팜올레인유, 채종유, 가공버터)', '쇼트닝', '전분1', '설탕', '전분2', '가공연유', '당류가공품'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '가루비 감자칩 오리지널', itemNo: 49,
  },
  {
    id: 'garubi-salmon', name: '가루비감자칩 연어초밥맛', brand: '해태', category: 'snack', unit: 'g',
    weight: 55, kcal: 305, sodium: 370, sugar: 3, fat: 19, carbs: 31, protein: 3,
    ingredients: ['감자전분플러스{감자전분1(독일산), 감자전분2(감자:국내산)}', '전분가공품(태국산:타피오카전분, 설탕, 정제소금)', '혼합식용유{팜올레인유(말레이시아산), 팜유(말레이시아산), 올레오레진로즈메리}', '건조감자분말(미국산)', '곡류가공품1(소맥분, 찹쌀, 전분)', '마가린(팜유, 가공유지, 팜올레인유, 채종유, 가공버터)', '쇼트닝', '전분1', '설탕', '전분2', '가공연유', '당류가공품'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '연어초밥맛 가루비', itemNo: 50,
  },
  {
    id: 'freetime', name: '자유시간', brand: '해태', category: 'snack', unit: 'g',
    weight: 36, kcal: 172, sodium: 55, sugar: 19, fat: 8, carbs: 22, protein: 3,
    ingredients: ['밀가루{밀(미국산)}', '준초콜릿{설탕,대두유(외국산:네덜란드,러시아,태국 등),코코아프리퍼레이션(외국산:네덜란드,벨기에,독일),코코아분말,팜올레인유}', '캔디류{기타설탕,포도당,아라비아검,합성향료,혼합제제1(자주색고구마색소,홍화황색소,구연산,말토덱스트린)}', '설탕', '혼합식용유{팜올레인유(말레이시아산),팜유(말레이시아산),올레오레진로즈메리}', '곡류가공품', '쇼트닝', '가공버터', '밀키페이스트', '볶음참깨', '가공치즈', '정제소금'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '초코·쿠키 한 막대', itemNo: 51,
  },
  {
    id: 'freetime-cookies', name: '자유시간 쿠키앤크림', brand: '해태', category: 'snack', unit: 'g',
    weight: 30, kcal: 135, sodium: 50, sugar: 16.8, fat: 4.6, carbs: 22, protein: 1,
    ingredients: ['밀가루{밀(미국산)}', '준초콜릿{설탕,대두유(외국산:네덜란드,러시아,태국 등),코코아프리퍼레이션(외국산:네덜란드,벨기에,독일),코코아분말,팜올레인유}', '캔디류{기타설탕,포도당,아라비아검,합성향료,혼합제제1(자주색고구마색소,홍화황색소,구연산,말토덱스트린)}', '설탕', '혼합식용유{팜올레인유(말레이시아산),팜유(말레이시아산),올레오레진로즈메리}', '곡류가공품', '쇼트닝', '가공버터', '밀키페이스트', '볶음참깨', '가공치즈', '정제소금'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '쿠키앤크림 맛 자유시간', itemNo: 52,
  },
  {
    id: 'freetime-deul', name: '자유시간들', brand: '해태', category: 'snack', unit: 'g',
    weight: 60, kcal: 295, sodium: 95, sugar: 27, fat: 14.4, carbs: 36, protein: 5.4,
    ingredients: ['밀가루{밀(미국산)}', '준초콜릿{설탕,대두유(외국산:네덜란드,러시아,태국 등),코코아프리퍼레이션(외국산:네덜란드,벨기에,독일),코코아분말,팜올레인유}', '캔디류{기타설탕,포도당,아라비아검,합성향료,혼합제제1(자주색고구마색소,홍화황색소,구연산,말토덱스트린)}', '설탕', '혼합식용유{팜올레인유(말레이시아산),팜유(말레이시아산),올레오레진로즈메리}', '곡류가공품', '쇼트닝', '가공버터', '밀키페이스트', '볶음참깨', '가공치즈', '정제소금'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '한 봉지에 여러 개', itemNo: 53,
  },
  {
    id: 'sunkist', name: '썬키스트', brand: '해태', category: 'snack', unit: 'g',
    weight: 125, kcal: 521, sodium: 0, sugar: 78.1, fat: 0, carbs: 130.2, protein: 0,
    ingredients: ['①레몬 : 물엿', '설탕', '레몬농축쥬스(고형분함량 40 %) 2.4 %', 'D-소비톨액(감미료) 1.3 %', '구연산', '향료(레몬향)', '식물성유지(경화유)', '유화제', '쇼트닝\\r\\n②오렌지 : 물엿', '설탕', '오렌지농축액(고형분함량 65 %) 2 %', 'D-소비톨액(감미료) 1.9 %'],
    bulk: [{kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}, {kind: 'seasoning', label: '소금·향료', sub: '정제소금·향료', share: 0.5}],
    note: '새콤한 썬키스트 캔디', itemNo: 54,
  },
  {
    id: 'osatsu', name: '오사쯔', brand: '해태', category: 'snack', unit: 'g',
    weight: 120, kcal: 720, sodium: 480, sugar: 20, fat: 48, carbs: 68, protein: 4,
    ingredients: ['오사쯔파스타(태국산)(밀가루,감자전분,밀전분,냉동증숙고구마,고구마파우더)', '혼합식용유[팜올레인유(말레이시아산),고올레산해바라기유{외국산(우크라이나,아르헨티나,스페인 등)},해바라기유,토코페롤(혼합형)]', '복합조미식품[고구마맛시즈닝{고구마맛베이스(정제소금(국내산),고구마분말(고구마(국내산))),제삼인산칼슘}]', '정제야자유', '향료'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}, {kind: 'seasoning', label: '소금·향료', sub: '정제소금·향료', share: 0.5}],
    note: '고구마맛 튀김 과자', itemNo: 55,
  },
  {
    id: 'frenchpie-strawberry', name: '후렌치파이 딸기', brand: '해태', category: 'snack', unit: 'g',
    weight: 192, kcal: 887, sodium: 444, sugar: 59.1, fat: 38.4, carbs: 118.1, protein: 10.4,
    ingredients: ['밀가루{밀(미국산)}', '기타설탕(설탕,전분)', '쇼트닝{팜유류1(말레이시아산),팜유류2(말레이시아산),올레오레진로즈메리}', '전란액(국산)', '코코아분말1(싱가포르산)', '가공버터', '코코아분말2(싱가포르산)', '기타가공품', '팽창제', '레시틴', '향료제제(프로필렌글리콜,향료,정제수,트리아세틴,젖산)', '정제소금'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '딸기잼 프렌치파이', itemNo: 56,
  },
  {
    id: 'frenchpie-apple', name: '후렌치파이 사과', brand: '해태', category: 'snack', unit: 'g',
    weight: 192, kcal: 887, sodium: 369, sugar: 59.1, fat: 34, carbs: 132.9, protein: 10.4,
    ingredients: ['밀가루{밀(미국산)}', '기타설탕(설탕,전분)', '쇼트닝{팜유류1(말레이시아산),팜유류2(말레이시아산),올레오레진로즈메리}', '전란액(국산)', '코코아분말1(싱가포르산)', '가공버터', '코코아분말2(싱가포르산)', '기타가공품', '팽창제', '레시틴', '향료제제(프로필렌글리콜,향료,정제수,트리아세틴,젖산)', '정제소금'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '사과잼 프렌치파이', itemNo: 57,
  },
  {
    id: 'tayo', name: '붕붕붕 꼬마버스 타요', brand: '해태', category: 'kids', unit: 'g',
    weight: 140, kcal: 238, sodium: 147, sugar: 8.4, fat: 9.8, carbs: 33.6, protein: 4.2,
    ingredients: ['밀가루{밀(미국산)}', '설탕', '쇼트닝{팜올레인유(말레이시아산),팜스테아린유(말레이시아산),동물성유지,가공유지,야자경화유}', '전란액(국산)', '마가린', '전지분유', '저지방우유', '물엿', '기타가공품', '가공치즈', '정제소금', '팽창제'],
    bulk: [{kind: 'flour', label: '곡물·전분', sub: '밀가루·전분 계열', share: 3.2}, {kind: 'sweet', label: '당류·시럽', sub: '설탕·물엿류', share: 1.4}, {kind: 'oil', label: '식물성유지', sub: '팜유·쇼트닝', share: 1.2}],
    note: '아이 손에 쏙, 타요 과자', itemNo: 58,
  },
  {
    id: 'ari-energy-lemon', name: '아리 에너지드링크 레몬크레스트', brand: '팔도', category: 'drink', unit: 'ml',
    weight: 355, kcal: 10, sodium: 280, sugar: 0, fat: 0, carbs: 2, protein: 1,
    ingredients: ['정제수', '이산화탄소', '산도조절제 2종', '천연향료', '타우린', '정제소금(국산)', '스테비올배당체(감미료)', '아카시아검(프랑스산)', '과라나추출분말(브라질산)', '나한과추출분말', '카페인(향미증진제)', '혼합제제[D-소비톨액(감미료), 글리세린, 프로필렌글리콜, 폴리글리세린지방산에스테르, 해바라기유, 베타카로틴(착색료), 비타민E, 가공유지, 레시틴]'],
    bulk: [{kind: 'water', label: '정제수', sub: '정제수·탄산수', share: 3.5}, {kind: 'seasoning', label: '향료·산도조절제', sub: '천연향료·산도조절제', share: 0.4}],
    note: '레몬크레스트 향 에너지드링크', itemNo: 59,
  },
  {
    id: 'ari-energy-orange', name: '아리 에너지드링크 오렌지아워', brand: '팔도', category: 'drink', unit: 'ml',
    weight: 355, kcal: 10, sodium: 280, sugar: 0, fat: 0, carbs: 2, protein: 1,
    ingredients: ['정제수', '이산화탄소', '산도조절제 2종', '천연향료', '타우린', '정제소금(국산)', '스테비올배당체(감미료)', '아카시아검(프랑스산)', '과라나추출분말(브라질산)', '나한과추출분말', '과채가공품', '카페인(향미증진제)'],
    bulk: [{kind: 'water', label: '정제수', sub: '정제수·탄산수', share: 3.5}, {kind: 'seasoning', label: '향료·산도조절제', sub: '천연향료·산도조절제', share: 0.4}],
    note: '오렌지 향 에너지드링크', itemNo: 60,
  },
  {
    id: 'ari-energy-berry', name: '아리 에너지드링크 블러쉬베리', brand: '팔도', category: 'drink', unit: 'ml',
    weight: 355, kcal: 10, sodium: 280, sugar: 0, fat: 0, carbs: 2, protein: 1,
    ingredients: ['정제수', '이산화탄소', '산도조절제 2종', '천연향료', '타우린', '정제소금(국산)', '스테비올배당체(감미료)', '아카시아검(프랑스산)', '과라나추출분말(브라질산)', '과채가공품', '나한과추출분말', '카페인(향미증진제)'],
    bulk: [{kind: 'water', label: '정제수', sub: '정제수·탄산수', share: 3.5}, {kind: 'seasoning', label: '향료·산도조절제', sub: '천연향료·산도조절제', share: 0.4}],
    note: '베리 향 에너지드링크', itemNo: 61,
  },
];

export const productById = (id) => PRODUCTS.find((p) => p.id === id) ?? null;
export const categoryName = (key) => CATEGORIES.find((c) => c.key === key)?.name ?? key;
