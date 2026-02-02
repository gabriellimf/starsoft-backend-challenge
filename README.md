# Cinema API — NestJS, PostgreSQL, Kafka, Redis

Back-end para venda de ingressos em rede de cinemas, com foco em concorrência, idempotência e expiração de reservas. A API foi construída em NestJS seguindo boas práticas (SOLID, separação de camadas, validação, logging), usa PostgreSQL (TypeORM), Kafka (kafkajs) para eventos e Redis para cache e locks distribuídos.

## Tecnologias

- Node.js 20 + NestJS 10
- TypeORM + PostgreSQL
- Kafka (kafkajs) + Zookeeper
- Redis (cache + Redlock)
- Swagger (OpenAPI) em /api-docs (com persistência de Authorization)
- Prometheus (/metrics) + Grafana (dashboards provisionados)
- Elasticsearch + Kibana (eventos indexados)
- ESLint + Prettier + Jest

## Como executar

Pré-requisitos:

- Docker e Docker Compose

1. Ajuste as variáveis de ambiente, se necessário, no arquivo `.env` (opcional). Há um `.env.example` com defaults.
2. Suba toda a stack (agora com proxy Nginx na porta 3000):

```bash
docker compose up --build -d
```

Serviços expostos:

- API (via proxy): http://localhost:3000 (Swagger em http://localhost:3000/api-docs)
- Postgres: localhost:5432
- Redis: localhost:6379
- Kafka: localhost:3002
- Kafka UI: http://localhost:8080
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001
- Elasticsearch (HTTP): http://localhost:3003
- Kibana: http://localhost:5601

Para desenvolvimento local sem Docker, instale dependências e rode a API:

```bash
npm install
npm run start:dev
```

### Migrations (Banco de Dados)

O schema é gerenciado por migrations (sem `synchronize`). As migrations rodam automaticamente no startup da aplicação, mas você também pode executar manualmente (scripts atualizados para `ts-node`):

```bash
# Executar migrations
npm run typeorm:run

# Reverter última migration
npm run typeorm:revert
```

Observação: configure `DATABASE_URL` no ambiente ou `.env`.

### Swagger (OpenAPI)

- UI: http://localhost:3000/api-docs
- Dica: a raiz `/` redireciona para `/api-docs`.
- O botão Authorize do Swagger mantém o token ao navegar entre rotas (persistAuthorization).
- Se não conseguir acessar `/api-docs`:
  - Verifique se o container `cinemaapi` está saudável: `docker compose ps`.
  - Abra os logs: `docker compose logs -f api` e confira a mensagem de startup.
  - Confirme se a porta 3000 está livre e mapeada: `localhost:3000`.

### Troubleshooting: API não inicia / Swagger inacessível

Sintomas:
- Outros serviços (Prometheus, Kafka UI, Grafana, Kibana) sobem, mas a API fica em `health: starting` e `http://localhost:3000/api-docs` não abre.
- Logs do container `api` mostram erro de migration, por exemplo: `column "seatid" does not exist` em `InitialSchema1670000000000`.

Causa provável:
- Conflito entre uma migration legada e a migration atual.

Como resolver:
- Remova a migration antiga `src/shared/database/migrations/1670000000000-initial-schema.ts` (já foi removida neste repo) e mantenha apenas a `20260201120000-init-schema.ts`.
- Rebuild sem cache e suba novamente os serviços.
- Se o banco já tem schema inconsistente, opcionalmente derrube com volumes e suba de novo.

Comandos (opcionais):

```bash
# rebuild sem cache
docker compose build --no-cache api

# subir toda a stack
docker compose up -d

# (opcional) resetar volumes do Postgres
docker compose down -v && docker compose up -d
```

## Visão geral da solução

- Concorrência: ao reservar assentos, aplicamos locks distribuídos via Redlock (Redis) por assento (`lock:session:{sessionId}:seat:{seatId}`) e transação no banco para garantir consistência. As chaves são ordenadas antes da aquisição para prevenir deadlock. O número mínimo de assentos por sessão é validado (>= 16) tanto no DTO quanto no service.
- Idempotência: endpoints críticos de escrita (POST /reservations, POST /reservations/:id/confirm-payment) aceitam header `Idempotency-Key`. Um interceptor armazena a resposta no Redis por alguns minutos e devolve a mesma resposta em replays seguros.
- Expiração: um job (cron) verifica periodicamente reservas pendentes com `expiresAt` ultrapassado, marca como `EXPIRED` e publica evento `reservation.expired`, além de `seat.released` explicitamente.
- Eventos: ao criar reserva e confirmar pagamento, publicamos eventos (`reservation.created`, `payment.confirmed`). Em expiração, publicamos `reservation.expired` e `seat.released`. Em mock mode (`KAFKA_MOCK_MODE=true`) a conexão é ignorada.
- DLQ: se o processamento de um evento falhar após retries com backoff, o payload + metadados é encaminhado ao tópico `cinema-dlq`; contamos em Prometheus (`dlq_messages_total{original_topic,reason}`).
- Rate limiting: limite global por IP/usuário (via header `x-user-id`) usando Nest Throttler; parâmetros configuráveis por env.
- Disponibilidade em tempo real: endpoint de disponibilidade considera vendas confirmadas e reservas pendentes ainda não expiradas.

## Estratégias implementadas

1. Race Conditions: evitadas combinando locks por assento (Redis/Redlock) e transação no Postgres. Além disso, há unique constraint de venda por assento (`sales.seatId`) que reforça a idempotência de confirmação.
2. Deadlock: chaves de lock são sempre ordenadas, garantindo ordem global na aquisição.
3. Idempotência: interceptor baseado em Redis utilizando header `Idempotency-Key` (cache de resposta 5 min). Replays retornam `Idempotency-Replay: true`.
4. Expiração: cron (a cada 10s) expira reservas `PENDING` com `expiresAt < now` e emite `reservation.expired`.

## Endpoints principais (exemplos)

- Criar sessão
  - POST /sessions
  - body: `{ "movieTitle": "Filme X", "startTime": "2026-01-30T19:00:00.000Z", "room": "Sala 1", "price": 25, "seatsCount": 16 }`

Exemplo no Swagger: acesse `Sessions > POST /sessions` e use os exemplos de payload.

- Disponibilidade da sessão
  - GET /sessions/{sessionId}/availability
  - resposta: `{ sessionId, items: [{ seatId, code, status: 'AVAILABLE'|'RESERVED'|'SOLD', expiresAt? }] }`

Exemplo no Swagger: `Sessions > GET /sessions/{id}/availability`.

- Reservar assentos
  - POST /reservations
  - headers: `Idempotency-Key: <uuid>` (recomendado)
  - body: `{ "userId": "u1", "sessionId": "<sessionId>", "seatIds": ["<seatId>"] }`
  - resposta: `{ reservationIds: ["..."], expiresAt: "..." }`

Exemplo no Swagger: `Reservations > POST /reservations`.

- Confirmar pagamento
  - POST /reservations/{reservationId}/confirm-payment
  - headers: `Idempotency-Key: <uuid>` (recomendado)
  - body: `{ "userId": "u1" }`
  - resposta: `{ saleId: "..." }`

Exemplo no Swagger: `Reservations > POST /reservations/{id}/confirm-payment`.

- Métricas
  - GET /metrics
  - expõe métricas Prometheus: `http_requests_total`, `http_request_duration_seconds`, `reservation_events_total`, `dlq_messages_total`

- Histórico do usuário
  - GET /users/{userId}/purchases

Documentação completa: acessar Swagger em `/api-docs`.

## Decisões técnicas

- TypeORM com Postgres: maturidade, transações e integrações sólidas.
- Redlock: lock distribuído simples e eficaz para múltiplas instâncias.
- Kafkajs: cliente Kafka estável e amplamente usado. Em modo mock, evita dependência local.
- Idempotência no edge (interceptor): simples, explícita e por rota, sem acoplamento à regra de negócio.
- Separação por camadas: controllers -> services -> repos (via TypeORM), além de módulos compartilhados (db, cache, kafka, locks).

## Limitações conhecidas

- Migrations: não foram adicionadas scripts prontos; o projeto está com `synchronize` configurável por env (dev). Em produção, usar migrations.
- Autenticação: não há auth; `userId` é um identificador lógico recebido no payload.
- Pagamentos: fluxo simulado; integração real com gateway não incluída.
- Observabilidade: Prometheus (/metrics) com Grafana provisionada (dashboard "Cinema API Overview"), Elasticsearch com eventos indexados e Kibana para visualização.

## Melhorias futuras

- Adicionar migrations e pipeline CI com testes e lint.
- Refinar DLQ (reprocessamento, alertas), e configurabilidade de retries.
- Cache de disponibilidade por sessão com invalidação por eventos (melhorar latência sob carga).
- Testes de carga/concorrência e chaos testing.
- Rate limiting mais granular por rota/tenant.

## Fluxo sugerido para teste manual

Abra o Swagger em `http://localhost:3000/api-docs` e siga:

1. Criar sessão "Filme X - 19:00" com 16 assentos, R$ 25,00
  - `POST /sessions` com payload de exemplo; copie `id` da sessão retornada.
2. Listar disponibilidade
  - `GET /sessions/{id}/availability`; identifique um `seatId` disponível.
3. Simular concorrência (2 usuários reservando o mesmo assento)
  - Faça duas chamadas a `POST /reservations` com o mesmo `seatId` e `Idempotency-Key` diferentes.
  - Esperado: apenas uma reserva é criada; a outra falha (assento já reservado) ou retorna idempotente.
4. Confirmar pagamento
  - `POST /reservations/{id}/confirm-payment` usando `reservationId` da reserva válida.
5. Verificar histórico
  - `GET /users/{userId}/purchases` para ver a venda confirmada.

### Fluxo de teste (com Postman)

Há uma collection pronta em `scripts/postman.collection.json` cobrindo:

- Criar sessão, checar disponibilidade
- Reservar assentos e confirmar pagamento
- Ver histórico do usuário
- Métricas e Swagger

Observação: o collection inclui requisições ao Swagger (`GET /api-docs`). Caso o browser não exiba, confira os logs do container `api`.

Importe a collection no Postman e siga as requisições numeradas.

### Rate limiting (quick test)

Configuração por env:

```env
RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=100
```

Teste por usuário:

```bash
seq 1 120 | xargs -I{} curl -s -o /dev/null -w "%{http_code}\n" \
  -H 'x-user-id: user-123' \
  http://localhost:3000/sessions/{sessionId}/availability | sort | uniq -c
```

Após exceder o limite dentro do TTL, respostas `429` são esperadas.

### Kibana quickstart

1. Acesse Kibana em http://localhost:5601
2. Crie um index pattern: `cinema-events`
3. Abra Discover e filtre por `type:reservation.created` (ou `payment.confirmed`, `reservation.expired`, `seat.released`)
4. Visualize timeline e campos (sessionId, seatId, userId, etc.)

### Grafana

1. Acesse Grafana em http://localhost:3001
2. Painel provisionado: "Cinema API Overview"
3. Métricas principais:
   - `http_requests_total{method,path,status_code}`
   - `http_request_duration_seconds_bucket` (p95 por rota)
   - `reservation_events_total{event_type}`
   - `dlq_messages_total{original_topic,reason}`

### Kafka UI

- Acesse http://localhost:8080 e inspecione tópicos:
  - `reservation.created`, `payment.confirmed`, `reservation.expired`, `seat.released`, `cinema-dlq`

### Populando dados rapidamente (curl)

```bash
# Criar sessão
curl -s -X POST http://localhost:3000/sessions \
  -H 'Content-Type: application/json' \
  -d '{"movieTitle":"Filme X","startTime":"2026-01-30T19:00:00.000Z","room":"Sala 1","price":25.0,"seatsCount":8}'

# Checar disponibilidade
curl -s http://localhost:3000/sessions/{sessionId}/availability

# Reservar (com idempotency)
curl -s -X POST http://localhost:3000/reservations \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: 4b8f...' \
  -d '{"userId":"u1","sessionId":"{sessionId}","seatIds":["{seatId}"],"ttlSeconds":30}'

# Confirmar pagamento (com idempotency)
curl -s -X POST http://localhost:3000/reservations/{reservationId}/confirm-payment \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: 6f2c...' \
  -d '{"userId":"u1"}'
```

### Multi-instância (escala horizontal)

Para validar coordenação entre réplicas (proxy Nginx na frente da API):

```bash
# subir com duas réplicas
docker compose up -d --build
docker compose up -d --scale api=2

# (opcional) usar o script de carga para disputar o mesmo assento
bash scripts/load-test.sh {sessionId} {seatId}
```

Como garantimos consistência:

- Locks distribuídos com Redlock (Redis) por assento evitam reservas simultâneas conflitantes.
- Idempotência baseada em Redis (edge) evita replays duplicados em múltiplas instâncias.
- Transações no Postgres asseguram atomicidade das operações de reserva/venda.

---

Qualidade > Quantidade: o foco está no núcleo seguro (reserva/sell única, idempotência, expiração), observabilidade e documentação de operação.

## Notas recentes de implementação

- Mínimo de assentos por sessão: agora validado com `@Min(16)` no `CreateSessionDto` e reforçado no `SessionsService` (erro 400 se `seatsCount < 16`).
- Escala horizontal: adicionado serviço `proxy` (Nginx) em `docker-compose.yml` com `proxy/nginx.conf`, permitindo `docker compose up -d --scale api=2` sem conflito de porta/nome de container. A API interna expõe a porta 3000 apenas na rede de containers.
- Scripts de migrations: atualizados para usar `ts-node` (`typeorm:run` e `typeorm:revert`).
- `init-db.sql`: pasta agora montada em `/docker-entrypoint-initdb.d` do Postgres para inicialização opcional; as migrations continuam sendo executadas automaticamente no startup.
