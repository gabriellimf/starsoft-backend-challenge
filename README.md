# Cinema API — NestJS, PostgreSQL, Kafka, Redis

Back-end para venda de ingressos em rede de cinemas, com foco em concorrência, idempotência e expiração de reservas. A API foi construída em NestJS seguindo boas práticas (SOLID, separação de camadas, validação, logging), usa PostgreSQL (TypeORM), Kafka (kafkajs) para eventos e Redis para cache e locks distribuídos.

## Tecnologias

- Node.js 20 + NestJS 10
- TypeORM + PostgreSQL
- Kafka (kafkajs) + Zookeeper
- Redis (cache + Redlock)
- Swagger (OpenAPI) em /api-docs
- ESLint + Prettier + Jest

## Como executar

Pré-requisitos:

- Docker e Docker Compose

1. Ajuste as variáveis de ambiente, se necessário, no arquivo `.env` (opcional). Há um `.env.example` com defaults.
2. Suba toda a stack:

```bash
docker-compose up --build
```

Serviços expostos:

- API: http://localhost:3000 (Swagger em http://localhost:3000/api-docs)
- Postgres: localhost:5432
- Redis: localhost:6379
- Kafka: localhost:3002
- Kafka UI: http://localhost:8080

Para desenvolvimento local sem Docker, instale dependências e rode a API:

```bash
npm install
npm run start:dev
```

## Visão geral da solução

- Concorrência: ao reservar assentos, aplicamos locks distribuídos via Redlock (Redis) por assento (`lock:session:{sessionId}:seat:{seatId}`) e transação no banco para garantir consistência. As chaves são ordenadas antes da aquisição para prevenir deadlock.
- Idempotência: endpoints críticos de escrita (POST /reservations, POST /reservations/:id/confirm-payment) aceitam header `Idempotency-Key`. Um interceptor armazena a resposta no Redis por alguns minutos e devolve a mesma resposta em replays seguros.
- Expiração: um job (cron) verifica periodicamente reservas pendentes com `expiresAt` ultrapassado, marca como `EXPIRED` e publica evento `reservation.expired`.
- Eventos: ao criar reserva e confirmar pagamento, publicamos eventos (`reservation.created`, `payment.confirmed`). Em mock mode (`KAFKA_MOCK_MODE=true`) a conexão é ignorada.
- Disponibilidade em tempo real: endpoint de disponibilidade considera vendas confirmadas e reservas pendentes ainda não expiradas.

## Estratégias implementadas

1. Race Conditions: evitadas combinando locks por assento (Redis/Redlock) e transação no Postgres. Além disso, há unique constraint de venda por assento (`sales.seatId`) que reforça a idempotência de confirmação.
2. Deadlock: chaves de lock são sempre ordenadas, garantindo ordem global na aquisição.
3. Idempotência: interceptor baseado em Redis utilizando `Idempotency-Key` (cache de resposta 5 min). Replays retornam `Idempotency-Replay: true`.
4. Expiração: cron (a cada 10s) expira reservas `PENDING` com `expiresAt < now` e emite `reservation.expired`.

## Endpoints principais (exemplos)

- Criar sessão
  - POST /sessions
  - body: `{ "movieTitle": "Filme X", "startTime": "2026-01-30T19:00:00.000Z", "room": "Sala 1", "price": 25, "seatsCount": 16 }`

- Disponibilidade da sessão
  - GET /sessions/{sessionId}/availability
  - resposta: `{ sessionId, items: [{ seatId, code, status: 'AVAILABLE'|'RESERVED'|'SOLD', expiresAt? }] }`

- Reservar assentos
  - POST /reservations
  - headers: `Idempotency-Key: <uuid>` (recomendado)
  - body: `{ "userId": "u1", "sessionId": "<sessionId>", "seatIds": ["<seatId>"] }`
  - resposta: `{ reservationIds: ["..."], expiresAt: "..." }`

- Confirmar pagamento
  - POST /reservations/{reservationId}/confirm-payment
  - headers: `Idempotency-Key: <uuid>` (recomendado)
  - body: `{ "userId": "u1" }`
  - resposta: `{ saleId: "..." }`

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
- Observabilidade extra (Grafana/Prometheus/Elasticsearch): fora do escopo inicial, mas integrável.

## Melhorias futuras

- Adicionar migrations e pipeline CI com testes e lint.
- DLQ e retries com backoff nos consumidores Kafka.
- Cache de disponibilidade por sessão com invalidação por eventos (melhorar latência sob carga).
- Testes de carga/concorrência e chaos testing.
- Rate limiting por IP/usuário.

## Fluxo sugerido para teste manual

1. Criar sessão "Filme X - 19:00" com 16 assentos, R$ 25,00
2. Listar disponibilidade
3. Simular 2 usuários tentando reservar o mesmo assento simultaneamente (duas requisições POST /reservations com o mesmo `seatId`)
4. Verificar: apenas uma reserva é criada; a outra requisição deve falhar com mensagem de assento já reservado
5. Confirmar pagamento da reserva criada (POST /reservations/{id}/confirm-payment)
6. Verificar histórico de compras (GET /users/{userId}/purchases)

---

Qualidade > Quantidade: o foco está no núcleo seguro (reserva/sell única, idempotência, expiração) com código limpo e extensível.
