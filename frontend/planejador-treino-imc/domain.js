export function calculateBMI(weight, heightCm) {
  if (!Number.isFinite(weight) || !Number.isFinite(heightCm) || weight <= 0 || heightCm <= 0) throw new Error('Informe peso e altura maiores que zero.');
  const value = weight / ((heightCm / 100) ** 2);
  const category = value < 18.5 ? 'Abaixo do peso' : value < 25 ? 'Faixa de peso adequada' : value < 30 ? 'Faixa de sobrepeso' : 'Faixa de obesidade';
  return { value, category };
}
export function filterPlans(plans, goal, level) {
  return plans.filter(p => (goal === 'todos' || p.goal === goal) && (level === 'todos' || p.level === level || p.level === 'todos'));
}
export const plans = [
 { id:'inteiro', name:'Corpo inteiro', goal:'perder', level:'iniciante', days:'3 dias por semana', duration:'45 min', description:'Musculação + caminhada', schedule:['Segunda','Quarta','Sexta'], sessions:[
  {name:'Treino A · Corpo inteiro', exercises:[['Aquecimento · caminhada','1','5–10 min','Leve'],['Leg press','3','10–12','60–90 s'],['Remada sentada','3','10–12','60–90 s'],['Supino máquina','3','10–12','60–90 s'],['Mesa flexora','2','10–12','60 s'],['Prancha','2','20–30 s','60 s'],['Caminhada','1','10–15 min','Moderada']]},
  {name:'Treino B · Corpo inteiro', exercises:[['Aquecimento · bicicleta','1','5–10 min','Leve'],['Agachamento no banco','3','10–12','60–90 s'],['Puxada frontal','3','10–12','60–90 s'],['Desenvolvimento máquina','2','10–12','60–90 s'],['Elevação de quadril','3','10–12','60 s'],['Abdominal dead bug','2','8–10 por lado','60 s'],['Bicicleta','1','10–15 min','Moderada']]}
 ]},
 { id:'forca', name:'Força & cardio', goal:'perder', level:'intermediario', days:'4 dias por semana', duration:'55 min', description:'Divisão superior / inferior', schedule:['Segunda','Terça','Quinta','Sexta'], sessions:[
  {name:'Treino A · Membros superiores',exercises:[['Aquecimento','1','5–10 min','Leve'],['Supino com halteres','3','8–12','90 s'],['Remada sentada','3','8–12','90 s'],['Puxada frontal','3','10–12','90 s'],['Desenvolvimento sentado','2','10–12','60–90 s'],['Tríceps na polia','2','10–15','60 s'],['Cardio','1','15 min','Moderado']]},
  {name:'Treino B · Membros inferiores',exercises:[['Aquecimento','1','5–10 min','Leve'],['Leg press','3','8–12','90 s'],['Levantamento romeno com halteres','3','8–12','90 s'],['Cadeira extensora','2','10–15','60 s'],['Mesa flexora','2','10–15','60 s'],['Panturrilha','3','12–15','60 s'],['Cardio','1','10–15 min','Moderado']]}
 ]},
 { id:'manutencao', name:'Manutenção ativa', goal:'manter', level:'todos', days:'3 dias por semana', duration:'40 min', description:'Força + cardio moderado', schedule:['Segunda','Quarta','Sexta'],sessions:[
  {name:'Treino A · Força',exercises:[['Aquecimento','1','5–10 min','Leve'],['Leg press','3','10–12','60–90 s'],['Supino máquina','3','10–12','60–90 s'],['Remada sentada','3','10–12','60–90 s'],['Prancha','2','20–30 s','60 s'],['Caminhada','1','10 min','Moderada']]},
  {name:'Treino B · Movimento',exercises:[['Bicicleta ou caminhada','1','20–25 min','Moderada'],['Elevação de quadril','3','10–12','60 s'],['Puxada frontal','3','10–12','60–90 s'],['Mobilidade confortável','1','5–10 min','Leve']]}
 ]}
];
