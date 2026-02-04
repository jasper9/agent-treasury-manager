# Solana Development Guidelines (Jan 2026)

**Source:** https://solana.com/SKILL.md

## Stack Decisions

### 1. SDK: @solana/kit first
- Use `@solana/kit` for all new Solana code
- Types: `Address`, `Signer`, transaction message APIs, codecs
- Instruction builders: `@solana-program/*` over hand-rolled

### 2. Legacy compatibility
- Only use `@solana/web3.js` at boundaries
- Use `@solana/web3-compat` as adapter
- Don't let web3.js types leak across app

### 3. Testing
- **Unit tests:** LiteSVM or Mollusk (fast, in-process)
- **Integration tests:** Surfpool (realistic cluster state)
- **Only use solana-test-validator** when you need specific RPC behaviors

## Implementation Checklist

Always be explicit about:
- ✅ cluster + RPC endpoints + websocket endpoints
- ✅ fee payer + recent blockhash
- ✅ compute budget + prioritization
- ✅ expected account owners + signers + writability
- ✅ token program variant (SPL Token vs Token-2022)

## Security Notes

When implementing signing/fees/CPIs/token transfers:
- Document risk areas
- Test with real scenarios
- Validate all accounts
- Check compute budget limits

## TODO for Agent Treasury Manager

- [ ] Migrate from `@solana/web3.js` to `@solana/kit`
- [ ] Add LiteSVM unit tests for treasury logic
- [ ] Use proper instruction builders for swaps
- [ ] Implement proper error handling for transactions
- [ ] Add compute budget optimization

## Reference

Full guide with progressive disclosure:
- frontend-framework-kit.md
- kit-web3-interop.md
- programs-anchor.md
- testing.md
- security.md

Saved: 2026-02-03 23:14 MST
