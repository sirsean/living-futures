// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ContractRegistry is Ownable {
    struct Version {
        address implementation;
        uint256 deployedAt;
        string versionTag;
    }
    
    mapping(string => address) public proxies;
    mapping(string => Version[]) public implementations;
    mapping(string => uint256) public currentVersion;
    
    event ProxyRegistered(string contractName, address proxy);
    event ImplementationRegistered(string contractName, address implementation, string versionTag);
    event VersionUpdated(string contractName, uint256 version);
    
    constructor(address initialOwner) Ownable(initialOwner) {}
    
    function registerProxy(string memory contractName, address proxy) external onlyOwner {
        require(proxy != address(0), "Invalid proxy address");
        require(proxies[contractName] == address(0), "Proxy already registered");
        
        proxies[contractName] = proxy;
        emit ProxyRegistered(contractName, proxy);
    }
    
    function registerImplementation(
        string memory contractName, 
        address implementation, 
        string memory versionTag
    ) external onlyOwner {
        require(implementation != address(0), "Invalid implementation address");
        require(proxies[contractName] != address(0), "Proxy not registered");
        
        implementations[contractName].push(Version({
            implementation: implementation,
            deployedAt: block.timestamp,
            versionTag: versionTag
        }));
        
        currentVersion[contractName] = implementations[contractName].length - 1;
        
        emit ImplementationRegistered(contractName, implementation, versionTag);
        emit VersionUpdated(contractName, currentVersion[contractName]);
    }
    
    function getProxy(string memory contractName) external view returns (address) {
        return proxies[contractName];
    }
    
    function getCurrentImplementation(string memory contractName) external view returns (address) {
        require(implementations[contractName].length > 0, "No implementations registered");
        return implementations[contractName][currentVersion[contractName]].implementation;
    }
    
    function getImplementationCount(string memory contractName) external view returns (uint256) {
        return implementations[contractName].length;
    }
    
    function getImplementationAt(string memory contractName, uint256 index) 
        external 
        view 
        returns (address implementation, uint256 deployedAt, string memory versionTag) 
    {
        require(index < implementations[contractName].length, "Index out of bounds");
        Version memory version = implementations[contractName][index];
        return (version.implementation, version.deployedAt, version.versionTag);
    }
    
    function setCurrentVersion(string memory contractName, uint256 versionIndex) external onlyOwner {
        require(versionIndex < implementations[contractName].length, "Invalid version");
        currentVersion[contractName] = versionIndex;
        emit VersionUpdated(contractName, versionIndex);
    }
}