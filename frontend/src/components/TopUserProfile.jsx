import { Link } from 'react-router-dom';
import { API_ORIGIN } from '../services/api';
export default function TopUserProfile(){const user=JSON.parse(localStorage.getItem('user')||'{}');return <Link to="/profile" className="top-user-profile">{user.profilePicture?<img src={`${API_ORIGIN}${user.profilePicture}`} alt={user.name||'User'}/>:<span>{(user.name||'U')[0]}</span>}<div><b>{user.name||'Health User'}</b><small>{user.role||'Patient'}</small></div></Link>}
