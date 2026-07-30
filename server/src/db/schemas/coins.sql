create table coins (
    symbol text primary key,
    display_name text not null, 
    base_asset text not null,   -- for cosmetic it will display user have 1000 BTC instead of BTCUSDT
    is_active boolean not null default true,    -- when the user sells there coin we will not be deleting it as we want to keep a trade history which points to the coin, deleting would mean no history, so toggling it off works
    sort_order int default 0,   -- controls the display order in our UI list so the order of coin when querying remains the same each time
)