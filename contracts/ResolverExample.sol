// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "./libraries/TokensAndAmounts.sol";
import "./interfaces/IResolver.sol";
import "@1inch/solidity-utils/contracts/libraries/SafeERC20.sol";

contract ResolverExample is IResolver {
    error OnlyOwner();
    error OnlySettlement();
    error FailedExternalCall(uint256 index, bytes reason);

    using TokensAndAmounts for bytes;
    using SafeERC20 for IERC20;
    using AddressLib for Address;

    address private immutable _settlement;
    address private immutable _owner;

    constructor(address settlement) {
        _settlement = settlement;
        _owner = msg.sender;
    }

    function resolveOrders(address resolver, bytes calldata tokensAndAmounts, bytes calldata data) external {
        if (msg.sender != _settlement) revert OnlySettlement();
        if (resolver != _owner) revert OnlyOwner();

        if (data.length > 0) {
            (Address[] memory targets, bytes[] memory calldatas) = abi.decode(data, (Address[], bytes[]));
            for (uint256 i = 0; i < targets.length; ++i) {
                // solhint-disable-next-line avoid-low-level-calls
                (bool success, bytes memory reason) = targets[i].get().call(calldatas[i]);
                if (!success) revert FailedExternalCall(i, reason);
            }
        }

        TokensAndAmounts.Data[] calldata items = tokensAndAmounts.decode();
        for (uint256 i = 0; i < items.length; i++) {
            IERC20(items[i].token.get()).safeTransfer(msg.sender, items[i].amount);
        }
    }

    function rescueFunds(IERC20 token) external {
        require(msg.sender == _owner, "caller is not owner");
        token.safeTransfer(msg.sender, token.balanceOf(address(this)));
    }
}
