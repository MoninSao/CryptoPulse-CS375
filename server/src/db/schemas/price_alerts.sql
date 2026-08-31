-- price_alerts: user-configured "buy when price drops to X" limit orders.
-- The price poller checks pending alerts every cycle and auto-executes a
-- buy via tradeService.executeTrade() once the live price <= target_price.

create table price_alerts (
    id uuid primary key default gen_random_uuid(),
    symbol text not null,
    target_price numeric(20,8) not null,
    quantity numeric(28,8) not null,
    status text not null default 'pending'
        check (status in ('pending', 'executed', 'cancelled', 'failed')),
    created_at timestamptz not null default now(),
    executed_at timestamptz,
    trade_id uuid references trades(id),
    last_error text,
    foreign key (symbol) references coins(symbol)
);

-- Poller's check-and-execute runs every cycle and needs to fetch only
-- pending alerts quickly, scoped by symbol.
create index idx_price_alerts_status_symbol on price_alerts(status, symbol);
