export default function FormField({icon:Icon,error,...props}){return <label className={`field ${error?'invalid':''}`}>{Icon&&<Icon/>}<input {...props}/>{error&&<small>{error}</small>}</label>}
