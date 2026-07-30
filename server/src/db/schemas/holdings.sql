--holding tables 

create table holdings (
    id uuid primary key default gen_random_uuid(),  -- temp will have login feature so will be tied to a real user id later
    symbol text not null,   -- the coin the user owns, ie: bitcoin
    quantity numeric(28,8) not null,    -- the amount the user owns
    avg_cost_basis numeric(20,8) not null,   -- cost of the coin when first purchased
)

