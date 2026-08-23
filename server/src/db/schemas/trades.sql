-- trades table for storing transaction history

create table trades (
    id uuid primary key default gen_random_uuid(),
    symbol text not null,
    type text not null check (type in ('buy', 'sell')),
    quantity numeric(28,8) not null,
    unit_price numeric(20,8) not null,
    total_value numeric(28,8) not null,
    created_at timestamptz not null default now(),
    foreign key (symbol) references coins(symbol)
);

-- index for efficient historical lookups
create index idx_trades_symbol_created_at on trades(symbol, created_at);
