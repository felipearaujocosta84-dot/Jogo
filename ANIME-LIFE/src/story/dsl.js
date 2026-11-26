// Atalhos para escrever a história com menos ruído.
export const R = 'character_01'; // Rin Kuroha — vizinha do 202
export const M = 'character_02'; // Mei Asano — vizinha do 205
export const A = 'character_06'; // Akane Tachibana — irmã da antiga moradora
export const K = 'character_07'; // Kaito Hayami — vizinho do 203, entregador
export const H = 'character_08'; // Haru Mizuno — colega no Café Hoshi
export const Y = 'character_10'; // Kyo Amagiri — gerente do Café Hoshi

export const rel = (id, deltas) => ({ rel: [id, deltas] });
export const flag = (k, v = true) => ({ flag: k, v });
export const memory = (id, text) => ({ memory: [id, text] });
export const contact = (id) => ({ contact: id });
export const post = (id) => ({ post: id });
export const route = (id, state) => ({ route: [id, state] });
export const romance = (id, stage) => ({ romance: [id, stage] });
