export default function WalletConnectButton() {
  const handleConnect = () => {
    console.log('Wallet connection not yet implemented')
  }

  return (
    <button
      onClick={handleConnect}
      className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
    >
      Connect Wallet
    </button>
  )
}