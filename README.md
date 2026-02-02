# Cinema API — NestJS, PostgreSQL, Kafka, Redis

Back-end para venda de ingressos em rede de cinemas, com foco em concorrência, idempotência e expiração de reservas. Construído em NestJS seguindo boas práticas (SOLID, separação de camadas, validação, logging), com PostgreSQL (TypeORM), Kafka (kafkajs) para eventos e Redis para cache e locks distribuídos.

## Visão Geral

O sistema garante que nenhum assento seja vendido duas vezes usando:
- Locks distribuídos via Redlock (Redis) por assento
- Transações no Postgres e checagens de consistência
- Idempotência nos endpoints críticos (com `Idempotency-Key`)
- Expiração automática de reservas (cron) e liberação do assento
- Publicação/consumo de eventos com retry e DLQ mínimo

## Tecnologias Escolhidas

- Node.js 20 + NestJS 11
- TypeORM + PostgreSQL
- Kafka (kafkajs) + Zookeeper
- Redis (cache + Redlock)
- Swagger (OpenAPI) em `/api-docs`
- Prometheus (`/metrics`) + Grafana (dashboards provisionados)
- Elasticsearch + Kibana (indexação de eventos)
- ESLint + Prettier + Jest

## Como Executar

Pré-requisitos:
- Docker e Docker Compose

1) Subir a stack completa com Docker:

```bash
docker compose up -d --build
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

Para desenvolvimento local sem Docker:

```bash
npm install
npm run start:dev
```

### Popular dados iniciais

- As migrations rodam automaticamente no startup da aplicação.
- O diretório `init-db.sql/` é montado em `/docker-entrypoint-initdb.d` do Postgres e pode conter seeds SQL opcionais.
- Alternativa via API: use os comandos do tutorial abaixo para criar sessões e reservas.

### Como executar testes

- Testes:

```bash
npm test
```

- Cobertura:

```bash
npm run test:cov
```

- Watch mode:

```bash
npm run test:watch
```

## Tutorial rápido: iniciar e testar

1) Abrir a documentação da API (Swagger)
- URL: http://localhost:3000/api-docs
- A raiz `/` redireciona automaticamente para o Swagger.

2) Criar uma sessão e assentos

```bash
# Criar sessão "Filme X" com 16 assentos
curl -s -X POST http://localhost:3000/sessions \
  -H 'Content-Type: application/json' \
  -d '{
    "movieTitle":"Filme X",
    "startTime":"2026-01-30T19:00:00.000Z",
    "room":"Sala 1",
    "price":25.0,
    "seatsCount":16
  }'
```

Copie o `id` da sessão retornada.

3) Ver disponibilidade de assentos

```bash
curl -s http://localhost:3000/sessions/{sessionId}/availability
```

4) Reservar um assento (com Idempotency-Key)

```bash
curl -s -X POST http://localhost:3000/reservations \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 11111111-1111-1111-1111-111111111111' \
  -d '{
    "userId":"u1",
    "sessionId":"{sessionId}",
    "seatIds":["{seatId}"],
    "ttlSeconds":30
  }'
```

Guarde o `reservationId` retornado.

5) Confirmar pagamento da reserva

```bash
curl -s -X POST http://localhost:3000/reservations/{reservationId}/confirm-payment \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 22222222-2222-2222-2222-222222222222' \
  -d '{"userId":"u1"}'
```

6) Consultar histórico de compras do usuário

```bash
curl -s http://localhost:3000/users/u1/purchases
```

7) Simular concorrência (opcional)

```bash
# Escalar múltiplas instâncias da API por trás do Nginx
docker compose up -d --scale api=2

# Disputar o mesmo assento com o script de carga
bash scripts/load-test.sh {sessionId} {seatId}
```

8) Executar testes automatizados

```bash
npm test
```

## Endpoints da API (resumo)

- Sessions
  - POST `/sessions` — cria sessão com assentos
  - GET `/sessions/{id}/availability` — disponibilidade em tempo real
- Reservations
  - POST `/reservations` — cria reserva de assentos (TTL default 30s)
  - POST `/reservations/{id}/confirm-payment` — confirma pagamento e gera venda
- Users
  - GET `/users/{id}/purchases` — histórico de compras confirmadas
- Observabilidade
  - GET `/metrics` — métricas Prometheus
  - GET `/health` — health básico; `/health/liveness`, `/health/readiness`
- Docs
  - GET `/api-docs` — Swagger UI

## Estratégias Implementadas

1. Race Conditions: evitadas combinando locks por assento (Redis/Redlock) e transações no Postgres; unique constraint de venda por assento reforça idempotência.
2. Coordenação entre múltiplas instâncias: Nginx proxy na frente e Redlock para ordem global; idempotência baseada em Redis.
3. Deadlock: chaves de lock são sempre ordenadas, garantindo ordem global na aquisição.
4. Idempotência: interceptor baseado em Redis utilizando `Idempotency-Key` (cache de resposta 5 min; cabeçalho `Idempotency-Replay` nos replays).
5. Expiração: cron (a cada 10s) expira reservas `PENDING` com `expiresAt < now` e emite `reservation.expired` e `seat.released`.

## Decisões Técnicas

- TypeORM com Postgres por maturidade e suporte a transações.
- Redlock (Redis) para coordenação simples e eficaz.
- Kafkajs para Kafka; modo mock para desenvolvimento.
- Idempotência no interceptor (edge), desacoplada da regra de negócio.
- Separação por camadas: controllers → services → repos (TypeORM), módulos compartilhados (db, cache, kafka, locks, logging, metrics).

## Melhorias Futuras

- Migrations completas e pipeline CI com lint/test.
- Reprocessamento de DLQ com alertas.
- Testes de carga/concorrência mais amplos.
- Rate limiting por rota/tenant.

## Exemplo de Fluxo para Testar

1. Criar sessão "Filme X - 19:00"
2. Criar sala com no mínimo 16 assentos, a R$ 25,00 cada
3. Simular: 2 usuários tentando reservar o mesmo assento simultaneamente
4. Verificar quantidade de reservas geradas
5. Comprovar o funcionamento do fluxo de pagamento do assento

### Extras

- Collection Postman: `scripts/postman.collection.json`
- Grafana: Dashboard provisionado "Cinema API Overview"
- Kibana: criar index pattern `cinema-events` e filtrar por `type:reservation.created`, `payment.confirmed`, `reservation.expired`, `seat.released`
