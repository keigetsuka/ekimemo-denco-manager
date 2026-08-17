$dictPath = $Args[0];

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Version定数 - 駅メモサーバ側で定期的に変更があります(間違ってても弊害はなさそうです)
$version  = "2022022401";

# 画像の大きさ - large / small / medium
$size     = @("large", "medium", "small");

# 画像の使用用途 - full : 立ち絵 / slot : タイムラインの右下の画像 / face : 顔アイコン
# パスが異なるためこのプログラムでは指定不可 : occupied : 車両基地 / vacant : 車両基地(編成中) / disable : 未入手
$type     = @("full", "slot", "face");

# 表情リスト","misora","meguru","himegi"]}}
$emotions = @("usual", "smile", "dovey", "angry", "tired", "dreamy", "amaze", "grumpy", "proud", "waver", "relax");

# 辞書
if ($dictPath -and (Test-Path $dictPath)) {
    # "辞書ファイルをローカルからロードします"
    $dict = Get-Content $dictPath | ConvertFrom-Json;
} else {
    # "辞書ファイルをダウンロードします"
    $dict = iwr "https://raw.githubusercontent.com/sweshelo/ekihack/master/list.json" | ConvertFrom-Json
}
$wrapList = $dict | Get-Member | ?{$_.MemberType -eq "NoteProperty"} | select Name

# Generate URL
function pic_url($version, $name, $wrapping, $size, $type, $emotion){
    return "https://static.native.denco.social.mfac.jp/v=${version}/img/partner/${name}/${wrapping}/${size}/${type}_${emotion}.png";
}

# GUI Window

## Form
$Form = New-Object System.Windows.Forms.Form;
$Form.Size = "400, 300";
$Form.Text = "ekihack by Sweshelo a.k.a Pagrus Major"
$Form.StartPosition = "CenterScreen"

## Wrapping
$Wrap = New-Object System.Windows.Forms.GroupBox;
$Wrap.Location = "5, 5";
$Wrap.Size = "180, 140";
$Wrap.Text = "Wrappings"

$WrapChecks = New-Object System.Windows.Forms.CheckedListBox;
$WrapChecks.Location = "5, 20";
$WrapChecks.Size = "170, 120"
$WrapChecks.Items.AddRange($wrapList.Name);

$Wrap.Controls.Add($WrapChecks);

## Emotions
$Emo = New-Object System.Windows.Forms.GroupBox;
$Emo.Location = "190, 5";
$Emo.Size = "100, 140";
$Emo.Text = "Emotions";

$EmoChecks = New-Object System.Windows.Forms.CheckedListBox;
$EmoChecks.Location = "5, 20";
$EmoChecks.Size = "80, 120"
$EmoChecks.Items.AddRange($emotions);
$EmoChecks.SetItemChecked(0, $true);

$Emo.Controls.Add($EmoChecks);

## DENCO(H) Type
## Emotions
$Dencoh = New-Object System.Windows.Forms.GroupBox;
$Dencoh.Location = "295, 5";
$Dencoh.Size = "80, 140";
$Dencoh.Text = "DENCO(H)";

$DencohChecks = New-Object System.Windows.Forms.CheckedListBox;
$DencohChecks.Location = "5, 20";
$DencohChecks.Size = "70, 120"
$DencohChecks.Items.AddRange(@("original", "extra", "iks_gear", "special", "ijin"));

$Dencoh.Controls.Add($DencohChecks);

## Size
$SizeGroup = New-Object System.Windows.Forms.GroupBox;
$SizeGroup.Location = "5, 150";
$SizeGroup.Size = "80, 80";
$SizeGroup.Text = "Size";

$ofs = 0;
$SizeRadio = @();
$size | %{
    $obj = New-Object System.Windows.Forms.RadioButton;
    $obj.Location = "5, $(15 + $ofs * 20)";
    $obj.Size = "70,20";
    $obj.Text = $_;
    $SizeRadio += $obj;
    $ofs++;
}
$SizeRadio[0].Checked = $True;
$SizeGroup.Controls.AddRange($SizeRadio);

## Type
$TypeGroup = New-Object System.Windows.Forms.GroupBox;
$TypeGroup.Location = "90, 150";
$TypeGroup.Size = "80, 80";
$TypeGroup.Text = "Type";

$ofs = 0;
$TypeRadio = @();
$type | %{
    $obj = New-Object System.Windows.Forms.RadioButton;
    $obj.Location = "5, $(15 + $ofs * 20)";
    $obj.Size = "70,20";
    $obj.Text = $_;
    $TypeRadio += $obj;
    $ofs++;
}
$TypeRadio[0].Checked = $True;
$TypeGroup.Controls.AddRange($TypeRadio);

# DENCOH Selection
$DencohSelectFlag = $false;

$DencohSelectWrap = New-Object System.Windows.Forms.GroupBox;
$DencohSelectWrap.Location = "175, 150";
$DencohSelectWrap.Size = "115, 80";
$DencohSelectWrap.Text = "Search"

$DencohSelect = New-Object System.Windows.Forms.TextBox;
$DencohSelect.Location = "5, 20";
$DencohSelect.Size = "100, 35";
$DencohSelect.Text = "";

$DencohSearch = New-Object System.Windows.Forms.Button;
$DencohSearch.Location = "5, 45";
$DencohSearch.Size = "100, 25";
$DencohSearch.Text = "search";
$DencohSearch.Add_Click({
        $DencohSelectFlag = $False;
        $checkTarg = $DencohSelect.Text;
        $dict.default.original + $dict.default.special + $dict.default.iks_gear + $dict.default.extra + $dict.default.ijin | %{
        if ($_ -eq $checkTarg){
        $DencohSelectFlag = $True;
        return;
        }
        }

        if($DencohSelectFlag){
        $Text = "Found. Only '${checkTarg}' may downloads.";
        }else{
        $Text = "Undified specified denco(H) : ${checkTarg}";
        }
        [System.Windows.Forms.MessageBox]::Show($Text);
        });

$DencohSelectWrap.Controls.Add($DencohSelect);
$DencohSelectWrap.Controls.Add($DencohSearch);

## Control
$OK = New-Object System.Windows.Forms.Button;
$OK.Location = "295, 155";
$OK.Size = "80, 35";
$OK.Text = "Download";
$OK.DialogResult = "OK";

$CheckAll = New-Object System.Windows.Forms.Button;
$CheckAll.Location = "295, 195";
$CheckAll.Size = "80, 35";
$CheckAll.Text = "Check All";
$CheckAll.DialogResult = "None";
$CheckAll.Add_Click({
        for($i=0; $i -lt $($WrapChecks.Items).Length; $i++){
        $WrapChecks.SetItemChecked($i, $true);
        }
        for($i=0; $i -lt $($DencohChecks.Items).Length; $i++){
        $DencohChecks.SetItemChecked($i, $true);
        }
        });

# main
if (!(test-path download)) {
    mkdir download
}

$Form.Controls.Add($Wrap);
$Form.Controls.Add($Emo);
$Form.Controls.Add($Dencoh);
$Form.Controls.Add($SizeGroup);
$Form.Controls.Add($TypeGroup);
$Form.Controls.Add($OK);
$Form.Controls.Add($CheckAll);
$Form.Controls.Add($DencohSelectWrap);
$Form.Topmost = $True;

$status = $Form.ShowDialog();

# Download
if ($status -eq "OK"){
# チェック済み
    $DLDencoh = $DencohChecks.CheckedItems;
    $DLWrap = $WrapChecks.CheckedItems;
    $DLEmo = $EmoChecks.CheckedItems;
    $DLType = ($TypeRadio | ?{$_.Checked -eq $True}).Text
        $DLSize = ($SizeRadio | ?{$_.Checked -eq $True}).Text

# ダウンロード
        $SpecifiedDencoh = $DencohSelect.Text;
    $DLWrap | %{
        $wrapName = $_;
        $DLTarg = ${dict}.${wrapName}
        $DLDencoh | %{
            $dencohTypeKey = $_;
            ${DLTarg}.${dencohTypeKey} | %{
                $dencohName = $_;
                if(!$dencohName.Length -or ($SpecifiedDencoh.length -and $SpecifiedDencoh -ne $dencohName)){return;}
                $DLEmo | %{
                    $emotion = $_;
                    if (!(Test-Path "./download/${wrapName}")){mkdir "./download/${wrapName}"};
                    try{
                        Invoke-WebRequest "https://static.native.denco.social.mfac.jp/v=${version}/img/partner/${dencohName}/${wrapName}/${DLSize}/${DLType}_${emotion}.png" -OutFile "./download/${wrapName}/${dencohName}_${emotion}.png";
                    }catch{
                        echo "Download Failed : ${dencohName} ${emotion}"
                    }
                }
            }
        }
    }
}
