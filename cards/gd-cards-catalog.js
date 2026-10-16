/* GD 卡冊預覽資料（只在開發服 dev.gdclub.cc／本機使用；正式資料改由 GDBO GET /me/cards 回傳）。
 * No.001–027：大廳四大分類遊戲卡（預覽先開放 財神、戰神賽特、雷神索爾 三張）。
 * No.028–032：經典機車系列閃卡（卡圖 cards/art/），預覽全部已收集。
 * 戰鬥力為預先抽好的固定值；正式版由後端發卡時依稀有度區間隨機。 */
window.GD_CARDS_PREVIEW = [
  {"id": 1, "no": 1, "rarity": "R", "category": "exclusive", "owned": false},
  {"id": 2, "no": 2, "rarity": "N", "category": "exclusive", "owned": false},
  {"id": 3, "no": 3, "rarity": "N", "category": "exclusive", "owned": false},
  {"id": 4, "no": 4, "rarity": "R", "category": "exclusive", "owned": false},
  {"id": 5, "no": 5, "rarity": "SR", "category": "exclusive", "owned": false},
  {"id": 6, "no": 6, "rarity": "SSR", "category": "exclusive", "owned": false},
  {"id": 7, "no": 7, "rarity": "LR", "category": "slots", "owned": false},
  {"id": 8, "no": 8, "rarity": "UR", "category": "slots", "owned": false},
  {"id": 9, "no": 9, "rarity": "LR", "category": "slots", "gameKey": "90008", "name": "戰神賽特", "fx": "aurora", "power": 502731, "icon": "storm_of_seth_TCH.webp", "colors": ["#4a2a10", "#15102b"], "owned": true},
  {"id": 10, "no": 10, "rarity": "GDR", "category": "slots", "gameKey": "91009", "name": "財神", "fx": "gold", "power": 1300359, "icon": "god_of_fortune_TCH.webp", "colors": ["#5a161c", "#170a1b"], "owned": true},
  {"id": 11, "no": 11, "rarity": "SSR", "category": "slots", "gameKey": "91004", "name": "雷神索爾", "fx": "holo", "power": 72118, "icon": "thor_TCH.webp", "colors": ["#173568", "#0a1029"], "owned": true},
  {"id": 12, "no": 12, "rarity": "R", "category": "slots", "owned": false},
  {"id": 13, "no": 13, "rarity": "SR", "category": "slots", "owned": false},
  {"id": 14, "no": 14, "rarity": "SR", "category": "slots", "owned": false},
  {"id": 15, "no": 15, "rarity": "SR", "category": "slots", "owned": false},
  {"id": 16, "no": 16, "rarity": "UR", "category": "slots", "owned": false},
  {"id": 17, "no": 17, "rarity": "SSR", "category": "slots", "owned": false},
  {"id": 18, "no": 18, "rarity": "SSR", "category": "slots", "owned": false},
  {"id": 19, "no": 19, "rarity": "R", "category": "poker", "owned": false},
  {"id": 20, "no": 20, "rarity": "N", "category": "poker", "owned": false},
  {"id": 21, "no": 21, "rarity": "R", "category": "poker", "owned": false},
  {"id": 22, "no": 22, "rarity": "N", "category": "poker", "owned": false},
  {"id": 23, "no": 23, "rarity": "N", "category": "poker", "owned": false},
  {"id": 24, "no": 24, "rarity": "N", "category": "poker", "owned": false},
  {"id": 25, "no": 25, "rarity": "SR", "category": "fish", "owned": false},
  {"id": 26, "no": 26, "rarity": "R", "category": "fish", "owned": false},
  {"id": 27, "no": 27, "rarity": "UR", "category": "fish", "owned": false},
  {"id": 28, "no": 28, "name": "Yamaha RZ-R 125", "category": "moto", "rarity": "SSR", "fx": "prism", "power": 68420, "w": 1672, "h": 941, "img": "cards/art/028_rz_r_125.webp?v=20261016a", "thumb": "cards/art/028_rz_r_125_s.webp?v=20261016a", "owned": true},
  {"id": 29, "no": 29, "name": "Dio 50", "category": "moto", "rarity": "SR", "fx": "holo", "power": 23816, "w": 1672, "h": 941, "img": "cards/art/029_dio_50.webp?v=20261016a", "thumb": "cards/art/029_dio_50_s.webp?v=20261016a", "owned": true},
  {"id": 30, "no": 30, "name": "Dio 50 II", "category": "moto", "rarity": "SR", "fx": "glitter", "power": 31207, "w": 1536, "h": 1024, "img": "cards/art/030_dio_50_ii.webp?v=20261016a", "thumb": "cards/art/030_dio_50_ii_s.webp?v=20261016a", "owned": true},
  {"id": 31, "no": 31, "name": "三冠王 迪爵125", "category": "moto", "rarity": "SSR", "fx": "cosmos", "power": 54930, "w": 1672, "h": 941, "img": "cards/art/031_dijue_125.webp?v=20261016a", "thumb": "cards/art/031_dijue_125_s.webp?v=20261016a", "owned": true},
  {"id": 32, "no": 32, "name": "偉士牌 150", "category": "moto", "rarity": "UR", "fx": "radiant", "power": 187644, "w": 1672, "h": 941, "img": "cards/art/032_vespa_150.webp?v=20261016a", "thumb": "cards/art/032_vespa_150_s.webp?v=20261016a", "owned": true}
];
