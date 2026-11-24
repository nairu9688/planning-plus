-- pg_net hors du schéma public (lint 0014). Les fonctions restent dans le schéma `net`.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
