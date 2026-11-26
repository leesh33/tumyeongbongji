// 앱 이름·카피를 한 곳에서 바꾼다. (index.html의 <title>은 빌드 시 이 값을 쓴다)
export const APP = {
  name: '투명봉지',
  tagline: '과자 봉지를 투명하게 들여다보기',
  description:
    '나트륨은 라면 국물 국자로, 당류는 각설탕으로, 지방은 밥숟가락으로. 영양성분표를 눈에 보이는 단위로 바꿔 보여줍니다.',
  disclaimer:
    '본 이미지는 영양성분표를 바탕으로 환산해 구현한 참고용 이미지로, 특정 제품의 광고나 비하 의도는 없습니다.',
  dataNote:
    '영양정보는 각 제품의 공개 영양성분표를 참고해 정리했으며, 제조사 개정에 따라 실제와 다를 수 있습니다.',
  // 단위 환산 기준
  sodiumMgPerLadle: 220,
  sugarGPerCube: 3,
  fatGPerSpoon: 10,
};
