import { FaHeartPulse } from 'react-icons/fa6';
export default function Logo({compact=false}){return <div className="logo"><span><FaHeartPulse/></span>{!compact&&<b>Health<span>Nova</span></b>}</div>}
