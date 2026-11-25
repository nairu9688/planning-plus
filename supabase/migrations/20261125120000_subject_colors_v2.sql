-- Design v2 (C3) : Philo et Management mieux séparés de Lettres et Droit.
-- Ne touche que les couleurs encore à leur valeur d'origine (une couleur personnalisée est conservée).
update public.subjects set color = '#00897B' where key = 'philo' and upper(color) = '#0B8043';
update public.subjects set color = '#B0369B' where key = 'management' and upper(color) = '#8E24AA';
