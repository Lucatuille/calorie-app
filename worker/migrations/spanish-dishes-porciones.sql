UPDATE spanish_dishes SET
  porciones_guia = '[{"desc":"pincho bar","g":50,"kcal":230},{"desc":"cuña pequeña","g":90,"kcal":415},{"desc":"cuña estándar","g":130,"kcal":600},{"desc":"cuña grande","g":180,"kcal":830},{"desc":"media tortilla","g":260,"kcal":1200}]',
  referencias_visuales = 'Tortilla entera: 22-24cm diametro, 3cm altura, ~600g total. Una cuña = 1/4 tortilla. Si ocupa 2/3 del plato: cuña grande ~180g. Pincho en plato pequeño de bar: ~50g.'
WHERE nombre = 'Tortilla española';

UPDATE spanish_dishes SET
  porciones_guia = '[{"desc":"rebanada pequeña","g":55,"kcal":134},{"desc":"rebanada estándar","g":80,"kcal":195},{"desc":"rebanada grande","g":110,"kcal":268}]',
  referencias_visuales = 'Rebanada estandar barra pan = 2cm grosor, ~50g pan. Con tomate frotado y aceite el peso total es ~80g. Tosta de bar suele ser mas grande ~100-110g.'
WHERE nombre = 'Pan con tomate y aceite';

UPDATE spanish_dishes SET
  porciones_guia = '[{"desc":"bocadillo pequeño","g":130,"kcal":300},{"desc":"bocadillo estándar","g":180,"kcal":415},{"desc":"bocadillo grande","g":240,"kcal":554}]',
  referencias_visuales = 'Bocadillo estandar = barra 1/4 (~110g pan) + jamon. Si es de cuarto de barra normal de panaderia española = 180g total. Bocadillo de bar suele ser mas grande.'
WHERE nombre = 'Bocadillo de jamon serrano';

UPDATE spanish_dishes SET
  porciones_guia = '[{"desc":"media ración","g":75,"kcal":143},{"desc":"ración estándar tapa","g":150,"kcal":285},{"desc":"ración grande","g":220,"kcal":418}]',
  referencias_visuales = 'Racion estandar de tapa en cazuelita pequeña = ~150g. Si es plato compartido entre 2-3 personas multiplicar. Cazuelita de barro pequeña = ~150g.'
WHERE nombre = 'Patatas bravas';

UPDATE spanish_dishes SET
  porciones_guia = '[{"desc":"plato pequeño","g":250,"kcal":343},{"desc":"plato estándar","g":350,"kcal":480},{"desc":"plato grande","g":450,"kcal":617}]',
  referencias_visuales = 'Plato hondo estandar español lleno = 350g. Si dice un plato sin especificar usar 350g. Tupper mediano = 400-450g.'
WHERE nombre = 'Lentejas con chorizo';

UPDATE spanish_dishes SET
  porciones_guia = '[{"desc":"vaso pequeño","g":180,"kcal":76},{"desc":"vaso/bowl estándar","g":250,"kcal":105},{"desc":"bowl grande","g":350,"kcal":147}]',
  referencias_visuales = 'Vaso de agua estandar = 200ml. Bowl de sopa = 250-300ml. Taza de desayuno = 200ml. Brick individual = 330ml = 139 kcal.'
WHERE nombre = 'Gazpacho';

UPDATE spanish_dishes SET
  porciones_guia = '[{"desc":"1 croqueta mediana","g":40,"kcal":97},{"desc":"2 croquetas","g":80,"kcal":194},{"desc":"ración 3 croquetas","g":120,"kcal":290},{"desc":"ración bar 4-5 croquetas","g":180,"kcal":435}]',
  referencias_visuales = 'Croqueta casera media = tamaño de un huevo pequeño, ~40g. Croqueta de bar suele ser mas grande ~50-60g. Racion estandar en bar = 4-5 uds.'
WHERE nombre = 'Croquetas caseras';

UPDATE spanish_dishes SET
  porciones_guia = '[{"desc":"ración pequeña","g":250,"kcal":373},{"desc":"ración estándar","g":350,"kcal":522},{"desc":"ración grande","g":450,"kcal":671}]',
  referencias_visuales = 'Paellera de 4 personas = ~1.4kg total = 350g por persona. Si es plato de restaurante individual = 300-400g. Paella casera sirve mas.'
WHERE nombre = 'Paella valenciana';

UPDATE spanish_dishes SET
  porciones_guia = '[{"desc":"tapa pequeña","g":120,"kcal":168},{"desc":"cazuelita estándar","g":200,"kcal":280},{"desc":"plato principal","g":320,"kcal":448}]',
  referencias_visuales = 'Cazuelita de barro pequeña = ~150-200g. Si es plato principal con pan = 300g+. El aceite en el fondo de la cazuela = ~30ml ya incluido en los calculos.'
WHERE nombre = 'Gambas al ajillo';

UPDATE spanish_dishes SET
  porciones_guia = '[{"desc":"vaso pequeño","g":150,"kcal":147},{"desc":"bowl estándar","g":200,"kcal":196},{"desc":"bowl grande","g":280,"kcal":274}]',
  referencias_visuales = 'Bowl de sopa = 200-250ml. En restaurante suele servirse en cuenco pequeno ~150-200ml. Es mas denso que el gazpacho — mismo volumen pesa mas.'
WHERE nombre = 'Salmorejo';
