import { Link } from 'react-router-dom';
import { profilePhotoUrl } from '../services/api';
import { useAuth } from '../auth/AuthContext';
export default function TopUserProfile(){const {user:authUser}=useAuth();const user=authUser||{};const photo=profilePhotoUrl(user);return <Link to="/profile" className="top-user-profile">{photo?<img src={photo} alt={user.name||'User'}/>:<span>{(user.name||'U')[0]}</span>}<div><b>{user.name||'Health User'}</b><small>{user.role||'Patient'}</small></div></Link>}
