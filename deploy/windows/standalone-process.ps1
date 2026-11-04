function ConvertTo-WmsNativeArgument([AllowEmptyString()][string]$Value) {
    '"'+([regex]::Replace([regex]::Replace($Value,'(\\*)"','$1$1\"'),'(\\+)$','$1$1'))+'"'
}
function Invoke-WmsNative([string]$Executable,[string[]]$Arguments,[int]$TimeoutSeconds=180) {
    $start=New-Object Diagnostics.ProcessStartInfo
    $quoted=(@($Arguments|ForEach-Object { ConvertTo-WmsNativeArgument $_ }) -join ' ')
    if([IO.Path]::GetExtension($Executable) -in @('.bat','.cmd')) {
        $start.FileName=$env:ComSpec
        $start.Arguments='/d /s /c "'+(ConvertTo-WmsNativeArgument $Executable)+' '+$quoted+'"'
    }else{$start.FileName=$Executable;$start.Arguments=$quoted}
    $start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $process=New-Object Diagnostics.Process
    $process.StartInfo=$start
    $clock=[Diagnostics.Stopwatch]::StartNew()
    try {
        if(!$process.Start()){throw 'Native process did not start'}
        $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
        $timedOut=!$process.WaitForExit($TimeoutSeconds*1000)
        if($timedOut){
            $kill=New-Object Diagnostics.ProcessStartInfo
            $kill.FileName=Join-Path $env:SystemRoot 'System32\taskkill.exe'
            $kill.Arguments='/PID '+$process.Id+' /T /F';$kill.UseShellExecute=$false;$kill.CreateNoWindow=$true
            $killer=[Diagnostics.Process]::Start($kill)
            try{if(!$killer.WaitForExit(5000)){$killer.Kill()}}finally{$killer.Dispose()}
            if(!$process.WaitForExit(10000)){throw 'Native process did not stop after its deadline'}
        }
        $remaining=[Math]::Max(0,[int]($TimeoutSeconds*1000-$clock.Elapsed.TotalMilliseconds))
        if(![Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($stdout,$stderr),$remaining)){$timedOut=$true}
        $output='';$errorText=''
        if($stdout.Status -eq [Threading.Tasks.TaskStatus]::RanToCompletion){$output=$stdout.Result}
        if($stderr.Status -eq [Threading.Tasks.TaskStatus]::RanToCompletion){$errorText=$stderr.Result}
        [pscustomobject]@{ExitCode=$process.ExitCode;StandardOutput=$output;StandardError=$errorText;TimedOut=$timedOut}
    }finally{$process.Dispose()}
}
function Initialize-WmsPostgres([string]$Executable,[string]$DataRoot,[string]$PasswordFile) {
    $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $pgdata=Join-Path $DataRoot 'pgdata'
    if(![IO.Path]::GetFullPath($PasswordFile).StartsWith([IO.Path]::GetFullPath($DataRoot).TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Password file must remain inside private installation data.'}
    try {
        # PostgreSQL restricts its administrator token; grant only the invoking identity during initdb.
        foreach($entry in @(@($DataRoot,'RX'),@($PasswordFile,'R'),@($pgdata,'(OI)(CI)F'))){
            & icacls.exe $entry[0] /grant ('*'+$sid+':'+$entry[1])|Out-Null
            if($LASTEXITCODE -ne 0){throw 'Cannot grant temporary initdb access'}
        }
        Invoke-WmsNative $Executable @('-D',$pgdata,'-U','wms_cluster','--pwfile',$PasswordFile,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C') 120
    }finally{
        foreach($path in @($PasswordFile,$pgdata,$DataRoot)){
            & icacls.exe $path /remove:g ('*'+$sid)|Out-Null
            if($LASTEXITCODE -ne 0){throw 'Cannot remove temporary initdb permissions'}
        }
    }
}
